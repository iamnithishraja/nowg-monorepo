// Figma OAuth Manager
// Handles OAuth flow for Figma account integration

import { getEnvWithDefault } from "./env";

interface FigmaUser {
  id: string;
  email: string;
  handle: string;
  img_url?: string;
}

interface FigmaToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

interface FigmaConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

class FigmaOAuthManager {
  private config: FigmaConfig;

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Figma APIs can rate-limit (429). This helper retries a few times with backoff.
   */
  private async figmaFetch(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
    const maxAttempts = 4; // 1 initial + 3 retries
    const perAttemptTimeoutMs = 15_000;
    let attempt = 0;
    let lastResponse: Response | null = null;
    let lastError: unknown = null;

    while (attempt < maxAttempts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), perAttemptTimeoutMs);

      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(init?.headers ?? {}),
          },
        });
      } catch (err) {
        lastError = err;
        attempt += 1;

        // Timeout/network errors: retry with backoff.
        if (attempt < maxAttempts) {
          const waitMs = Math.min(8000, 500 * 2 ** (attempt - 1));
          await this.sleep(waitMs);
          continue;
        }

        throw new Error(
          `Figma request failed after ${maxAttempts} attempts: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      } finally {
        clearTimeout(timeout);
      }

      if (response.status !== 429) return response;

      lastResponse = response;
      attempt += 1;

      // Respect Retry-After when present; otherwise exponential backoff.
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(0, retryAfterSeconds) * 1000
        : Math.min(8000, 500 * 2 ** (attempt - 1));

      // Consume body so undici doesn't warn about leaked resources on retries.
      try {
        await response.arrayBuffer();
      } catch {
        // ignore
      }

      await this.sleep(waitMs);
    }

    // Give the last 429 response back to caller for consistent error handling.
    if (lastResponse) return lastResponse;

    throw new Error(
      `Figma request failed after ${maxAttempts} attempts${
        lastError ? `: ${lastError instanceof Error ? lastError.message : String(lastError)}` : ""
      }`
    );
  }

  constructor(redirectUri?: string) {
    const clientId = getEnvWithDefault("FIGMA_CLIENT_ID", "");
    const clientSecret = getEnvWithDefault("FIGMA_CLIENT_SECRET", "");

    if (!clientId) {
      throw new Error(
        "FIGMA_CLIENT_ID is not set. Please configure it in your environment variables."
      );
    }

    if (!clientSecret) {
      throw new Error(
        "FIGMA_CLIENT_SECRET is not set. Please configure it in your environment variables."
      );
    }

    const scopesFromEnv =
      getEnvWithDefault("FIGMA_SCOPES", "") ||
      getEnvWithDefault("FIGMA_SCOPE", "");

    // Scopes required by our integration endpoints.
    // Note: `/v1/me` requires `current_user:read` (used during OAuth callback to store the user email/id).
    const requiredScopes = [
      "current_user:read",
      "file_content:read",
      "file_metadata:read",
      "file_dev_resources:read",
      // required for /v1/teams/:teamId/projects and /v1/projects/:projectId/files
      "projects:read",
    ];

    const scopes = (scopesFromEnv ? scopesFromEnv : requiredScopes.join(" "))
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    this.config = {
      clientId,
      clientSecret,
      redirectUri:
        redirectUri ||
        getEnvWithDefault(
          "FIGMA_REDIRECT_URI",
          "http://localhost:5173/api/figma/callback"
        ),
      // Always include required scopes even if FIGMA_SCOPES/FIGMA_SCOPE is set.
      scopes: Array.from(new Set([...scopes, ...requiredScopes])),
    };
  }

  /**
   * Get the redirect URI being used
   */
  getRedirectUri(): string {
    return this.config.redirectUri;
  }

  /**
   * Generate OAuth URL for Figma authentication
   * Figma uses OAuth 2.0 authorization code flow
   */
  generateOAuthUrl(state: string): string {
    const redirectUri = this.getRedirectUri();

    // Validate redirect URI format
    try {
      new URL(redirectUri);
    } catch {
      throw new Error(
        `Invalid redirect URI format: ${redirectUri}. Please ensure it's a valid URL.`
      );
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      // OAuth scopes are space-delimited. Commas will be treated as part of the scope name and fail.
      scope: this.config.scopes.join(" "),
      state: state,
      response_type: "code",
    });

    // Figma OAuth endpoint
    const endpoint = "https://www.figma.com/oauth";
    const authUrl = `${endpoint}?${params.toString()}`;

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<FigmaToken> {
    const redirectUri = this.getRedirectUri();

    const response = await fetch("https://api.figma.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Figma token exchange failed:", responseText);
      throw new Error(
        `Token exchange failed: ${response.status} - ${responseText}`
      );
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response from Figma: ${responseText}`);
    }

    if (tokenData.error) {
      throw new Error(
        `Figma OAuth error: ${tokenData.error_description || tokenData.error}`
      );
    }

    return tokenData;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<FigmaToken> {
    const response = await fetch("https://api.figma.com/v1/oauth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Figma token refresh failed:", responseText);
      throw new Error(
        `Token refresh failed: ${response.status} - ${responseText}`
      );
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response from Figma: ${responseText}`);
    }

    if (tokenData.error) {
      throw new Error(
        `Figma OAuth error: ${tokenData.error_description || tokenData.error}`
      );
    }

    return tokenData;
  }

  /**
   * Get user information from Figma API
   */
  async getUserInfo(accessToken: string): Promise<FigmaUser> {
    const response = await fetch("https://api.figma.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get user info: ${response.status} - ${errorText}`);
    }

    const userData = await response.json();
    return userData;
  }

  /**
   * Get user's recent files
   */
  async getRecentFiles(accessToken: string): Promise<any[]> {
    /**
     * NOTE:
     * Figma's public REST API does not provide a stable "list my recent files" endpoint.
     * The previously used `/v1/me/files` returns 404 ("Not found") and breaks the import modal.
     *
     * We keep this method for UI compatibility, but return an empty list.
     * Users can still paste a file URL and import frames via `/v1/files/:fileKey`.
     */
    return [];
  }

  /**
   * Get user's team projects
   */
  async getTeamProjects(accessToken: string, teamId: string): Promise<any[]> {
    const response = await fetch(`https://api.figma.com/v1/teams/${teamId}/projects`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get team projects: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.projects || [];
  }

  /**
   * Get files in a project
   */
  async getProjectFiles(accessToken: string, projectId: string): Promise<any[]> {
    const response = await fetch(`https://api.figma.com/v1/projects/${projectId}/files`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get project files: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.files || [];
  }

  /**
   * Get file details including frames
   */
  async getFile(
    accessToken: string,
    fileKey: string,
    options?: { depth?: number }
  ): Promise<any> {
    const params = new URLSearchParams();
    if (options?.depth !== undefined) {
      params.set("depth", String(options.depth));
    }

    const url =
      params.size > 0
        ? `https://api.figma.com/v1/files/${fileKey}?${params.toString()}`
        : `https://api.figma.com/v1/files/${fileKey}`;

    const response = await this.figmaFetch(url, accessToken);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get file: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Get specific nodes from a file
   */
  async getFileNodes(accessToken: string, fileKey: string, nodeIds: string[]): Promise<any> {
    const idsParam = nodeIds.join(",");
    const response = await this.figmaFetch(
      `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`,
      accessToken
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get file nodes: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Get images for specific nodes
   */
  async getImages(
    accessToken: string,
    fileKey: string,
    nodeIds: string[],
    format: "jpg" | "png" | "svg" | "pdf" = "png",
    scale: number = 2
  ): Promise<Record<string, string>> {
    const idsParam = nodeIds.join(",");
    const response = await this.figmaFetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(idsParam)}&format=${format}&scale=${scale}`,
      accessToken
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get images: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.images || {};
  }

  /**
   * Generate random state for OAuth
   */
  generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Create authenticated fetch function using user's access token
   */
  createAuthenticatedFetch(
    accessToken: string
  ): (url: string, options?: RequestInit) => Promise<Response> {
    return async (url: string, options: RequestInit = {}) => {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      };

      return fetch(url, {
        ...options,
        headers,
      });
    };
  }
}

export { FigmaOAuthManager };
export type { FigmaUser, FigmaToken, FigmaConfig };
