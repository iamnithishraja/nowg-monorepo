import type { ActionFunctionArgs } from "react-router";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";
import FigmaIntegration from "../models/figmaIntegrationModel";
import { FigmaOAuthManager } from "../lib/figma-oauth-manager";

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
};

type FigmaFileResponse = {
  name: string;
  document: FigmaNode;
};

const FIGMA_API_BASE = "https://api.figma.com/v1";
const FIGMA_FRAMES_CACHE_TTL_MS = 30_000;

type FramesApiResponse = {
  fileKey: string;
  fileName: string;
  truncated: boolean;
  pages: Array<{
    pageId: string;
    pageName: string;
    frames: Array<{
      id: string;
      name: string;
      pageId: string;
      pageName: string;
      sectionName?: string;
      thumbnailUrl?: string | null;
    }>;
  }>;
  /**
   * True when we had to skip loading thumbnails (rate limit or other fetch error).
   * Frames will still be returned so the user can proceed.
   */
  thumbnailsPartial?: boolean;
};

const framesCache = new Map<
  string,
  { expiresAt: number; value: FramesApiResponse }
>();
const framesInflight = new Map<string, Promise<FramesApiResponse>>();

function cleanupFramesCache(now = Date.now()) {
  // Best-effort cleanup to prevent unbounded growth.
  // We keep this cheap by only scanning when the map gets moderately large.
  if (framesCache.size < 250) return;
  for (const [key, entry] of framesCache.entries()) {
    if (entry.expiresAt <= now) framesCache.delete(key);
  }
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(res: Response): number | undefined {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }

  const reset = res.headers.get("x-ratelimit-reset");
  if (reset) {
    const resetSeconds = Number(reset);
    if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
      const waitMs = resetSeconds * 1000 - Date.now();
      if (waitMs > 0) return waitMs;
    }
  }

  return undefined;
}

class FigmaHttpError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(args: { message: string; status: number; retryAfterMs?: number }) {
    super(args.message);
    this.name = "FigmaHttpError";
    this.status = args.status;
    this.retryAfterMs = args.retryAfterMs;
  }
}

/**
 * Fetch helper with rate-limit aware retry (429).
 * Uses a few attempts with exponential backoff and respects Retry-After when present.
 * For 429 errors with long retry-after values, returns immediately so UI can show cooldown.
 */
async function figmaFetch(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<Response> {
  const maxAttempts = 3; // 1 initial + 2 retries
  const perAttemptTimeoutMs = 15_000;
  // Max time we're willing to wait for auto-retry (2 seconds)
  // If retry-after is longer, return immediately so UI can handle it
  const maxAutoRetryWaitMs = 2_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), perAttemptTimeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(init?.headers || {}),
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      if (attempt >= maxAttempts) {
        throw new Error(
          `Figma request failed after ${maxAttempts} attempts: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
      const waitMs = Math.min(2000, 500 * 2 ** (attempt - 1));
      await sleep(waitMs);
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (res.status !== 429) return res;

    // For 429 responses, check if we should auto-retry or return immediately
    const retryAfterMs = parseRetryAfterMs(res);
    
    // If retry-after is too long or it's our last attempt, return immediately
    // Let the UI handle the cooldown/retry logic
    if (attempt >= maxAttempts || (retryAfterMs && retryAfterMs > maxAutoRetryWaitMs)) {
      return res;
    }

    const waitMs = Math.min(maxAutoRetryWaitMs, retryAfterMs ?? 500 * 2 ** (attempt - 1));

    try {
      await res.arrayBuffer();
    } catch {
      // ignore
    }

    await sleep(waitMs);
  }

  throw new Error("Figma request failed unexpectedly.");
}

function extractFigmaFileKey(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // If user pastes a raw key.
  if (/^[a-zA-Z0-9]{10,}$/.test(trimmed) && !trimmed.includes("/")) {
    return trimmed;
  }

  // Try parsing as URL.
  try {
    const url = new URL(trimmed);
    const path = url.pathname;

    const fileLike = path.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)(\/|$)/);
    if (fileLike) return fileLike[2] || null;

    const community = path.match(/\/community\/file\/([a-zA-Z0-9]+)(\/|$)/);
    if (community) return community[1] || null;

    return null;
  } catch {
    // Not a valid URL.
    return null;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function isTopLevelFrameCandidate(node: FigmaNode): boolean {
  return (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "COMPONENT_SET"
  );
}

async function figmaFetchJson<T>(
  url: string,
  accessToken: string
): Promise<T> {
  const res = await figmaFetch(url, accessToken);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryAfterMs = res.status === 429 ? parseRetryAfterMs(res) : undefined;
    throw new FigmaHttpError({
      status: res.status,
      retryAfterMs,
      message: `Figma API error (${res.status}) ${res.statusText}${
        text ? `: ${text}` : ""
      }`,
    });
  }

  return (await res.json()) as T;
}

async function requireUserId(request: Request): Promise<string | Response> {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    return json({ error: "Authentication required" }, { status: 401 });
  }

  return session.user.id;
}

async function requireFigmaAccessToken(
  request: Request,
  userId: string
): Promise<string | Response> {
  await connectToDatabase();
  const integration = await FigmaIntegration.findOne({ userId });

  if (!integration) {
    return json(
      { error: "Figma not connected", code: "FIGMA_NOT_CONNECTED" },
      { status: 400 }
    );
  }

  const now = new Date();
  let accessToken = integration.accessToken as string;

  if (integration.expiresAt && integration.expiresAt < now) {
    if (!integration.refreshToken) {
      return json(
        {
          error: "Figma token expired. Please reconnect.",
          code: "FIGMA_TOKEN_EXPIRED",
        },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const origin = url.origin;
    const redirectUri = `${origin}/api/figma/callback`;
    const figmaManager = new FigmaOAuthManager(redirectUri);

    try {
      const newToken = await figmaManager.refreshAccessToken(
        integration.refreshToken as string
      );

      const expiresAt = newToken.expires_in
        ? new Date(Date.now() + newToken.expires_in * 1000)
        : undefined;

      await FigmaIntegration.findOneAndUpdate(
        { userId },
        {
          accessToken: newToken.access_token,
          refreshToken: newToken.refresh_token,
          expiresAt,
          lastUsedAt: new Date(),
        }
      );

      accessToken = newToken.access_token;
    } catch (err) {
      console.error("Failed to refresh Figma token:", err);
      return json(
        {
          error: "Figma token expired. Please reconnect.",
          code: "FIGMA_TOKEN_REFRESH_FAILED",
        },
        { status: 400 }
      );
    }
  } else {
    await FigmaIntegration.findOneAndUpdate(
      { userId },
      { lastUsedAt: new Date() }
    );
  }

  return accessToken;
}

/**
 * API Route: Resolve Figma file URL -> top-level frames + thumbnail previews
 * POST /api/figma/frames
 * Body: { url: string }
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const userIdOrRes = await requireUserId(request);
    if (userIdOrRes instanceof Response) return userIdOrRes;
    const userId = userIdOrRes;

    const accessTokenOrRes = await requireFigmaAccessToken(request, userId);
    if (accessTokenOrRes instanceof Response) return accessTokenOrRes;
    const accessToken = accessTokenOrRes;

    const body = (await request.json().catch(() => null)) as
      | { url?: string }
      | null;
    const inputUrl = body?.url?.trim() || "";

    const fileKey = extractFigmaFileKey(inputUrl);
    if (!fileKey) {
      return json(
        { error: "Invalid Figma URL (could not extract file key)" },
        { status: 400 }
      );
    }

    const cacheKey = `${userId}:${fileKey}`;
    cleanupFramesCache();
    const cached = framesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return json(cached.value);
    }

    const inflight = framesInflight.get(cacheKey);
    if (inflight) {
      const value = await inflight;
      return json(value);
    }

    const computePromise = (async (): Promise<FramesApiResponse> => {
      const file = await figmaFetchJson<FigmaFileResponse>(
        `${FIGMA_API_BASE}/files/${encodeURIComponent(fileKey)}`,
        accessToken
      );

      const pages = (file.document.children || []).filter(
        (n) => n.type === "CANVAS"
      );

      type FrameItem = {
        id: string;
        name: string;
        pageId: string;
        pageName: string;
        sectionName?: string;
        thumbnailUrl?: string | null;
      };

      const allFrames: FrameItem[] = [];

      for (const page of pages) {
        const pageChildren = page.children || [];
        for (const child of pageChildren) {
          if (isTopLevelFrameCandidate(child)) {
            allFrames.push({
              id: child.id,
              name: child.name,
              pageId: page.id,
              pageName: page.name,
              thumbnailUrl: null,
            });
          } else if (child.type === "SECTION" && child.children?.length) {
            for (const grandChild of child.children) {
              if (isTopLevelFrameCandidate(grandChild)) {
                allFrames.push({
                  id: grandChild.id,
                  name: grandChild.name,
                  pageId: page.id,
                  pageName: page.name,
                  sectionName: child.name,
                  thumbnailUrl: null,
                });
              }
            }
          }
        }
      }

      const MAX_FRAMES = 200;
      const truncated = allFrames.length > MAX_FRAMES;
      const frames = truncated ? allFrames.slice(0, MAX_FRAMES) : allFrames;

      const ids = Array.from(new Set(frames.map((f) => f.id)));
      const idToThumb: Record<string, string | null> = {};
      let thumbnailsPartial = false;

      // Figma images endpoint is typically happiest with <= 100 ids per request.
      // If thumbnail loading fails (including rate limit), we still return frames.
      try {
        for (const idChunk of chunkArray(ids, 100)) {
          const imagesRes = await figmaFetchJson<{
            images: Record<string, string | null>;
            err?: string;
          }>(
            `${FIGMA_API_BASE}/images/${encodeURIComponent(
              fileKey
            )}?ids=${encodeURIComponent(
              idChunk.join(",")
            )}&format=png&scale=1&use_absolute_bounds=true`,
            accessToken
          );

          for (const [id, url] of Object.entries(imagesRes.images || {})) {
            idToThumb[id] = url;
          }
        }
      } catch (err) {
        thumbnailsPartial = true;
        console.warn(
          "[Figma] Failed to load thumbnails; continuing without previews:",
          err
        );
      }

      for (const f of frames) {
        f.thumbnailUrl = idToThumb[f.id] ?? null;
      }

      // Group by page for easier UI rendering.
      const byPage = new Map<
        string,
        { pageId: string; pageName: string; frames: FrameItem[] }
      >();
      for (const f of frames) {
        const key = f.pageId;
        const existing = byPage.get(key);
        if (existing) existing.frames.push(f);
        else
          byPage.set(key, {
            pageId: f.pageId,
            pageName: f.pageName,
            frames: [f],
          });
      }

      const value: FramesApiResponse = {
        fileKey,
        fileName: file.name,
        truncated,
        pages: Array.from(byPage.values()),
        ...(thumbnailsPartial ? { thumbnailsPartial: true } : {}),
      };

      framesCache.set(cacheKey, {
        expiresAt: Date.now() + FIGMA_FRAMES_CACHE_TTL_MS,
        value,
      });

      return value;
    })();

    framesInflight.set(cacheKey, computePromise);
    try {
      const value = await computePromise;
      return json(value);
    } finally {
      framesInflight.delete(cacheKey);
    }
  } catch (error) {
    console.error("Error resolving Figma frames:", error);
    if (error instanceof FigmaHttpError && error.status === 429) {
      return json(
        {
          error: "Figma rate limit exceeded. Please try again shortly.",
          code: "FIGMA_RATE_LIMITED",
          retryAfterMs: error.retryAfterMs,
          message: error.message,
        },
        { status: 429 }
      );
    }
    return json(
      {
        error: "Failed to load frames from Figma",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


