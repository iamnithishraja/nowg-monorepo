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

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
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

function isTopLevelFrameCandidate(node: FigmaNode): boolean {
  return (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "COMPONENT_SET"
  );
}

async function resolveTopLevelFramesFromFile(
  accessToken: string,
  fileKey: string
): Promise<{ fileName: string; nodeIds: string[]; frameNames: string[] }> {
  // Use a shallow-ish depth so we can see:
  // file.document -> pages (CANVAS) -> top-level children -> (optional SECTION children)
  const res = await fetch(
    `${FIGMA_API_BASE}/files/${encodeURIComponent(fileKey)}?depth=3`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch file data: ${res.status}`);
  }

  const file = (await res.json()) as FigmaFileResponse;
  const pages = (file.document.children || []).filter((n) => n.type === "CANVAS");

  const nodeIds: string[] = [];
  const frameNames: string[] = [];

  for (const page of pages) {
    const pageChildren = page.children || [];
    for (const child of pageChildren) {
      if (isTopLevelFrameCandidate(child)) {
        nodeIds.push(child.id);
        frameNames.push(child.name);
        continue;
      }

      if (child.type === "SECTION" && child.children?.length) {
        for (const grandChild of child.children) {
          if (isTopLevelFrameCandidate(grandChild)) {
            nodeIds.push(grandChild.id);
            frameNames.push(grandChild.name);
          }
        }
      }
    }
  }

  // De-dupe while preserving order.
  const seen = new Set<string>();
  const uniqueNodeIds: string[] = [];
  const uniqueFrameNames: string[] = [];
  for (let i = 0; i < nodeIds.length; i += 1) {
    const id = nodeIds[i]!;
    if (seen.has(id)) continue;
    seen.add(id);
    uniqueNodeIds.push(id);
    uniqueFrameNames.push(frameNames[i] || id);
  }

  return { fileName: file.name, nodeIds: uniqueNodeIds, frameNames: uniqueFrameNames };
}

/**
 * Get Figma design data using the Figma REST API directly
 * Since the MCP server requires desktop app integration,
 * we use the REST API to get frame/node data and images
 */
async function getFigmaDesignData(
  accessToken: string,
  fileKey: string,
  nodeIds: string[],
  opts?: { fileName?: string }
): Promise<{
  fileName: string;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    absoluteBoundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    children?: any[];
    fills?: any[];
    strokes?: any[];
    effects?: any[];
    cornerRadius?: number;
    layoutMode?: string;
    primaryAxisSizingMode?: string;
    counterAxisSizingMode?: string;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    itemSpacing?: number;
    characters?: string;
    style?: any;
  }>;
  images: Record<string, string>;
}> {
  // Fetch node data
  const nodesParam = nodeIds.join(",");
  const nodesResponse = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodesParam)}&geometry=paths`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!nodesResponse.ok) {
    throw new Error(`Failed to fetch node data: ${nodesResponse.status}`);
  }

  const nodesData = await nodesResponse.json();

  // Fetch file name
  let fileName = opts?.fileName;
  if (!fileName) {
    const fileResponse = await fetch(
      `${FIGMA_API_BASE}/files/${encodeURIComponent(fileKey)}?depth=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file data: ${fileResponse.status}`);
    }

    const fileData = (await fileResponse.json()) as { name?: string };
    fileName = fileData.name || "Figma Design";
  }

  // Fetch images for the nodes
  const imagesResponse = await fetch(
    `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodesParam)}&format=svg&svg_include_id=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  let images: Record<string, string> = {};
  if (imagesResponse.ok) {
    const imagesData = await imagesResponse.json();
    images = imagesData.images || {};
  }

  // Process node data
  const nodes: any[] = [];
  for (const nodeId of nodeIds) {
    const nodeData = nodesData.nodes?.[nodeId];
    if (nodeData?.document) {
      nodes.push(processNode(nodeData.document));
    }
  }

  return {
    fileName,
    nodes,
    images,
  };
}

// Recursively process node to extract relevant design properties
function processNode(node: any, depth = 0): any {
  const MAX_DEPTH = 10; // Limit recursion depth for very complex designs

  const processed: any = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Add size and position
  if (node.absoluteBoundingBox) {
    processed.absoluteBoundingBox = node.absoluteBoundingBox;
  }
  if (node.size) {
    processed.size = node.size;
  }

  // Add visual properties
  if (node.fills && node.fills.length > 0) {
    processed.fills = node.fills;
  }
  if (node.strokes && node.strokes.length > 0) {
    processed.strokes = node.strokes;
  }
  if (node.effects && node.effects.length > 0) {
    processed.effects = node.effects;
  }
  if (node.cornerRadius !== undefined) {
    processed.cornerRadius = node.cornerRadius;
  }
  if (node.rectangleCornerRadii) {
    processed.rectangleCornerRadii = node.rectangleCornerRadii;
  }

  // Add layout properties (Auto Layout)
  if (node.layoutMode) {
    processed.layoutMode = node.layoutMode;
    processed.primaryAxisSizingMode = node.primaryAxisSizingMode;
    processed.counterAxisSizingMode = node.counterAxisSizingMode;
    processed.primaryAxisAlignItems = node.primaryAxisAlignItems;
    processed.counterAxisAlignItems = node.counterAxisAlignItems;
    processed.paddingLeft = node.paddingLeft;
    processed.paddingRight = node.paddingRight;
    processed.paddingTop = node.paddingTop;
    processed.paddingBottom = node.paddingBottom;
    processed.itemSpacing = node.itemSpacing;
  }

  // Add text properties
  if (node.type === "TEXT") {
    processed.characters = node.characters;
    processed.style = node.style;
  }

  // Add constraints
  if (node.constraints) {
    processed.constraints = node.constraints;
  }

  // Recursively process children (with depth limit)
  if (node.children && node.children.length > 0 && depth < MAX_DEPTH) {
    processed.children = node.children.map((child: any) => 
      processNode(child, depth + 1)
    );
  }

  return processed;
}

// Generate a prompt for the LLM to convert Figma design to React code
function generateFigmaToReactPrompt(
  designData: {
    fileName: string;
    nodes: any[];
    images: Record<string, string>;
  },
  frameNames: string[]
): string {
  const frameDescriptions = designData.nodes.map((node, index) => {
    return `
### Frame ${index + 1}: "${node.name}"
- Type: ${node.type}
- Size: ${node.absoluteBoundingBox?.width}x${node.absoluteBoundingBox?.height}px
${node.layoutMode ? `- Layout: ${node.layoutMode} (Auto Layout)` : ''}
${node.children ? `- Contains ${node.children.length} child elements` : ''}
`;
  }).join('\n');

  // Create a simplified structure description for the LLM
  const structureJson = JSON.stringify(
    designData.nodes.map(simplifyNodeForPrompt),
    null,
    2
  );

  return `Convert this Figma design "${designData.fileName}" to a beautiful React application with Tailwind CSS.

## Frames
${frameDescriptions}

## Design Structure (JSON)
The following JSON describes the design hierarchy and properties:

\`\`\`json
${structureJson}
\`\`\`

## Requirements
1. Create a pixel-perfect React implementation of the design
2. Use Tailwind CSS for styling (matching colors, spacing, fonts as closely as possible)
3. Make the design responsive and mobile-friendly
4. Use semantic HTML elements
5. Add hover effects and transitions where appropriate
6. If there are buttons or interactive elements, make them functional
7. Use React functional components with TypeScript
8. Structure the code cleanly with appropriate component separation

Please create a complete, working React application that faithfully reproduces this Figma design.`;
}

// Simplify node structure for the prompt (reduce token count)
function simplifyNodeForPrompt(node: any): any {
  const simplified: any = {
    name: node.name,
    type: node.type,
  };

  if (node.absoluteBoundingBox) {
    simplified.width = Math.round(node.absoluteBoundingBox.width);
    simplified.height = Math.round(node.absoluteBoundingBox.height);
  }

  // Add colors from fills
  if (node.fills && node.fills.length > 0) {
    const visibleFills = node.fills.filter((f: any) => f.visible !== false);
    if (visibleFills.length > 0) {
      simplified.backgroundColor = visibleFills.map((f: any) => {
        if (f.type === "SOLID" && f.color) {
          const r = Math.round(f.color.r * 255);
          const g = Math.round(f.color.g * 255);
          const b = Math.round(f.color.b * 255);
          const a = f.color.a ?? 1;
          return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
        }
        return f.type;
      });
    }
  }

  // Add border from strokes
  if (node.strokes && node.strokes.length > 0) {
    const visibleStrokes = node.strokes.filter((s: any) => s.visible !== false);
    if (visibleStrokes.length > 0) {
      simplified.hasBorder = true;
    }
  }

  // Add corner radius
  if (node.cornerRadius) {
    simplified.borderRadius = node.cornerRadius;
  }

  // Add layout info
  if (node.layoutMode) {
    simplified.layout = {
      mode: node.layoutMode === "VERTICAL" ? "column" : "row",
      gap: node.itemSpacing,
      padding: {
        top: node.paddingTop,
        right: node.paddingRight,
        bottom: node.paddingBottom,
        left: node.paddingLeft,
      },
      mainAxisAlign: node.primaryAxisAlignItems,
      crossAxisAlign: node.counterAxisAlignItems,
    };
  }

  // Add text content
  if (node.type === "TEXT" && node.characters) {
    simplified.text = node.characters;
    if (node.style) {
      simplified.textStyle = {
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        fontFamily: node.style.fontFamily,
        textAlign: node.style.textAlignHorizontal,
      };
    }
  }

  // Add children recursively
  if (node.children && node.children.length > 0) {
    simplified.children = node.children.map(simplifyNodeForPrompt);
  }

  return simplified;
}

/**
 * API Route: Get Figma design data and generate conversion prompt
 * POST /api/figma/mcp
 * Body: { fileKey: string, nodeIds: string[], frameNames: string[] }
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
      | {
          url?: string;
          fileKey?: string;
          nodeIds?: string[];
          frameNames?: string[];
        }
      | null;

    let fileKey = body?.fileKey;
    let nodeIds = body?.nodeIds;
    let frameNames = body?.frameNames ?? [];
    let resolvedFileName: string | undefined;

    // New flow: accept a Figma URL and automatically include all top-level frames.
    if (!fileKey && body?.url) {
      fileKey = extractFigmaFileKey(body.url) ?? undefined;
    }

    if (fileKey && (!nodeIds || nodeIds.length === 0)) {
      const resolved = await resolveTopLevelFramesFromFile(accessToken, fileKey);
      nodeIds = resolved.nodeIds;
      frameNames = resolved.frameNames;
      resolvedFileName = resolved.fileName;
    }

    if (!fileKey || !nodeIds || nodeIds.length === 0) {
      return json(
        { error: "Missing or invalid Figma URL / fileKey (no frames found)" },
        { status: 400 }
      );
    }

    // Get design data from Figma API
    const designData = await getFigmaDesignData(accessToken, fileKey, nodeIds, {
      fileName: resolvedFileName,
    });

    // Generate the prompt for React conversion
    const prompt = generateFigmaToReactPrompt(designData, frameNames);

    return json({
      success: true,
      prompt,
      designData: {
        fileName: designData.fileName,
        frameCount: designData.nodes.length,
        images: designData.images,
      },
    });
  } catch (error) {
    console.error("Error in Figma MCP endpoint:", error);
    return json(
      {
        error: "Failed to process Figma design",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

