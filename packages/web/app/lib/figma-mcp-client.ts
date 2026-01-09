/**
 * Figma MCP Client
 * Connects to Figma's official MCP server at https://mcp.figma.com/mcp
 * Enables AI models to make tool calls for design context, screenshots, and more
 */

// @ts-ignore - MCP SDK types will be available after pnpm install
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
// @ts-ignore - MCP SDK types will be available after pnpm install
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { connectToDatabase } from "./mongo";
import FigmaIntegration from "../models/figmaIntegrationModel";
import { FigmaOAuthManager } from "./figma-oauth-manager";

const FIGMA_MCP_SERVER_URL = "https://mcp.figma.com/mcp";

export interface FigmaMCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface FigmaMCPToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export class FigmaMCPClient {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private accessToken: string;
  private userId: string;
  private isConnected: boolean = false;
  private tools: FigmaMCPTool[] = [];
  private refreshToken?: string;
  private expiresAt?: Date;
  private redirectUri?: string;

  constructor(
    accessToken: string,
    userId: string,
    options?: {
      refreshToken?: string;
      expiresAt?: Date;
      redirectUri?: string;
    }
  ) {
    this.accessToken = accessToken;
    this.userId = userId;
    this.refreshToken = options?.refreshToken;
    this.expiresAt = options?.expiresAt;
    this.redirectUri = options?.redirectUri;
  }

  /**
   * Create an MCP client instance from a user ID by fetching their Figma credentials
   */
  static async fromUserId(
    userId: string,
    redirectUri?: string
  ): Promise<FigmaMCPClient | null> {
    await connectToDatabase();
    const integration = await FigmaIntegration.findOne({ userId });

    if (!integration) {
      return null;
    }

    const now = new Date();
    let accessToken = integration.accessToken as string;

    // Check if token needs refresh
    if (integration.expiresAt && integration.expiresAt < now) {
      if (!integration.refreshToken) {
        return null; // Token expired and no refresh token
      }

      try {
        const figmaManager = new FigmaOAuthManager(
          redirectUri || "http://localhost:5173/api/figma/callback"
        );
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
        console.error("Failed to refresh Figma token for MCP:", err);
        return null;
      }
    } else {
      await FigmaIntegration.findOneAndUpdate(
        { userId },
        { lastUsedAt: new Date() }
      );
    }

    return new FigmaMCPClient(accessToken, userId, {
      refreshToken: integration.refreshToken as string | undefined,
      expiresAt: integration.expiresAt as Date | undefined,
      redirectUri,
    });
  }

  /**
   * Connect to the Figma MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Create SSE transport with authentication
      this.transport = new SSEClientTransport(
        new URL(FIGMA_MCP_SERVER_URL),
        {
          requestInit: {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          },
        }
      );

      // Create the MCP client
      this.client = new Client(
        {
          name: "nowgai-figma-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // Connect to the server
      await this.client.connect(this.transport);
      this.isConnected = true;

      // Fetch available tools
      await this.refreshTools();

      console.log(
        `[FigmaMCP] Connected successfully. Available tools: ${this.tools.map((t) => t.name).join(", ")}`
      );
    } catch (error) {
      console.error("[FigmaMCP] Connection failed:", error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Refresh the list of available tools from the server
   */
  async refreshTools(): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("MCP client not connected");
    }

    try {
      const response = await this.client.listTools();
      this.tools = response.tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as FigmaMCPTool["inputSchema"],
      }));
    } catch (error) {
      console.error("[FigmaMCP] Failed to list tools:", error);
      throw error;
    }
  }

  /**
   * Get the list of available tools
   */
  getTools(): FigmaMCPTool[] {
    return this.tools;
  }

  /**
   * Call a tool on the Figma MCP server
   */
  async callTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<FigmaMCPToolResult> {
    if (!this.client || !this.isConnected) {
      throw new Error("MCP client not connected");
    }

    try {
      console.log(`[FigmaMCP] Calling tool: ${toolName}`, args);

      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      console.log(`[FigmaMCP] Tool ${toolName} completed`);

      return {
        content: result.content as FigmaMCPToolResult["content"],
        isError: result.isError as boolean | undefined,
      };
    } catch (error) {
      console.error(`[FigmaMCP] Tool call failed for ${toolName}:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error calling ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Helper: Get design context for a Figma URL or node
   */
  async getDesignContext(
    figmaUrl: string,
    options?: {
      depth?: number;
      includeChildren?: boolean;
    }
  ): Promise<FigmaMCPToolResult> {
    return this.callTool("get_design_context", {
      url: figmaUrl,
      ...options,
    });
  }

  /**
   * Helper: Get variable definitions
   */
  async getVariableDefs(figmaUrl: string): Promise<FigmaMCPToolResult> {
    return this.callTool("get_variable_defs", {
      url: figmaUrl,
    });
  }

  /**
   * Helper: Get code connect mappings
   */
  async getCodeConnectMap(figmaUrl: string): Promise<FigmaMCPToolResult> {
    return this.callTool("get_code_connect_map", {
      url: figmaUrl,
    });
  }

  /**
   * Helper: Get screenshot of a selection
   */
  async getScreenshot(
    figmaUrl: string,
    options?: {
      scale?: number;
      format?: "png" | "jpg" | "svg";
    }
  ): Promise<FigmaMCPToolResult> {
    return this.callTool("get_screenshot", {
      url: figmaUrl,
      ...options,
    });
  }

  /**
   * Helper: Get metadata for a node
   */
  async getMetadata(figmaUrl: string): Promise<FigmaMCPToolResult> {
    return this.callTool("get_metadata", {
      url: figmaUrl,
    });
  }

  /**
   * Helper: Get authenticated user info
   */
  async whoami(): Promise<FigmaMCPToolResult> {
    return this.callTool("whoami", {});
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.close();
      } catch (error) {
        console.error("[FigmaMCP] Disconnect error:", error);
      }
    }

    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.tools = [];
  }

  /**
   * Check if the client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }
}

/**
 * Connection pool for managing multiple MCP client instances
 */
class FigmaMCPConnectionPool {
  private connections: Map<
    string,
    { client: FigmaMCPClient; lastUsed: number }
  > = new Map();
  private maxConnections: number = 10;
  private connectionTTL: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Get or create a connection for a user
   */
  async getConnection(
    userId: string,
    redirectUri?: string
  ): Promise<FigmaMCPClient | null> {
    // Check for existing connection
    const existing = this.connections.get(userId);
    if (existing && existing.client.isClientConnected()) {
      existing.lastUsed = Date.now();
      return existing.client;
    }

    // Clean up stale connections
    this.cleanupStaleConnections();

    // Create new connection
    const client = await FigmaMCPClient.fromUserId(userId, redirectUri);
    if (!client) {
      return null;
    }

    try {
      await client.connect();
      this.connections.set(userId, { client, lastUsed: Date.now() });
      return client;
    } catch (error) {
      console.error(
        `[FigmaMCP Pool] Failed to connect for user ${userId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(userId: string): void {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.lastUsed = Date.now();
    }
  }

  /**
   * Close and remove a connection
   */
  async closeConnection(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection) {
      await connection.client.disconnect();
      this.connections.delete(userId);
    }
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleEntries: string[] = [];

    for (const [userId, connection] of this.connections) {
      if (now - connection.lastUsed > this.connectionTTL) {
        staleEntries.push(userId);
      }
    }

    // Disconnect stale connections
    for (const userId of staleEntries) {
      const connection = this.connections.get(userId);
      if (connection) {
        connection.client.disconnect().catch(console.error);
        this.connections.delete(userId);
      }
    }

    // If still over limit, remove oldest connections
    if (this.connections.size > this.maxConnections) {
      const sorted = Array.from(this.connections.entries()).sort(
        ([, a], [, b]) => a.lastUsed - b.lastUsed
      );

      const toRemove = sorted.slice(0, this.connections.size - this.maxConnections);
      for (const [userId, connection] of toRemove) {
        connection.client.disconnect().catch(console.error);
        this.connections.delete(userId);
      }
    }
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(
      (connection) => connection.client.disconnect()
    );
    await Promise.allSettled(closePromises);
    this.connections.clear();
  }
}

// Export singleton pool instance
export const figmaMCPPool = new FigmaMCPConnectionPool();

export default FigmaMCPClient;

