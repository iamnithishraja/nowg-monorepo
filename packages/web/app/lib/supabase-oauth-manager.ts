// Supabase OAuth Manager
// Handles OAuth flow for Supabase account integration

import { getEnv, getEnvWithDefault } from "./env";

interface SupabaseUser {
  id: string;
  email: string;
  name?: string;
}

interface SupabaseToken {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface SupabaseConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

class SupabaseOAuthManager {
  private config: SupabaseConfig;

  constructor(redirectUri?: string) {
    const clientId = getEnvWithDefault("SUPABASE_OAUTH_CLIENT_ID", "");
    const clientSecret = getEnvWithDefault("SUPABASE_OAUTH_CLIENT_SECRET", "");

    if (!clientId) {
      throw new Error(
        "SUPABASE_OAUTH_CLIENT_ID is not set. Please configure it in your environment variables."
      );
    }

    if (!clientSecret) {
      throw new Error(
        "SUPABASE_OAUTH_CLIENT_SECRET is not set. Please configure it in your environment variables."
      );
    }

    this.config = {
      clientId,
      clientSecret,
      redirectUri:
        redirectUri ||
        getEnvWithDefault(
          "SUPABASE_REDIRECT_URI",
          "http://localhost:5173/api/supabase/callback"
        ),
      scopes: [
        "read",
        "write",
        "analytics",
        "auth",
        "database",
        "storage",
        "functions",
      ], // Supabase OAuth scopes
    };
  }

  /**
   * Get the redirect URI being used
   */
  getRedirectUri(): string {
    return this.config.redirectUri;
  }

  /**
   * Generate OAuth URL for Supabase authentication
   * Supabase uses OAuth 2.0 authorization code flow
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
      scope: this.config.scopes.join(" "),
      state: state,
      response_type: "code",
    });

    // Supabase OAuth endpoint
    const endpoint = "https://api.supabase.com/v1/oauth/authorize";
    const authUrl = `${endpoint}?${params.toString()}`;

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<SupabaseToken> {
    const redirectUri = this.getRedirectUri();

    const response = await fetch("https://api.supabase.com/v1/oauth/token", {
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
      throw new Error(
        `Token exchange failed: ${response.status} - ${responseText}`
      );
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response from Supabase: ${responseText}`);
    }

    if (tokenData.error) {
      throw new Error(
        `Supabase OAuth error: ${
          tokenData.error_description || tokenData.error
        }`
      );
    }

    return tokenData;
  }

  /**
   * Get user information from Supabase API
   */
  async getUserInfo(accessToken: string): Promise<SupabaseUser> {
    // Fetch organizations directly to get the current organization
    // This is more reliable than getting it from projects
    let organizationId: string | undefined;
    let organizationName: string | undefined;

    try {
      const orgsResponse = await fetch(
        "https://api.supabase.com/v1/organizations",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (orgsResponse.ok) {
        const orgs = await orgsResponse.json();
        if (Array.isArray(orgs) && orgs.length > 0) {
          // Use the first organization (user can have multiple orgs)
          const org = orgs[0];
          organizationId = org.id || org.organization_id || org.organizationId;
          organizationName = org.name || org.organization_name;
        }
      }
    } catch (e) {
      console.warn(
        "Failed to fetch organizations, trying projects endpoint:",
        e
      );
    }

    // Fallback: try to get from projects if organizations endpoint failed
    if (!organizationId) {
      try {
        const projectsResponse = await fetch(
          "https://api.supabase.com/v1/projects",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (projectsResponse.ok) {
          const projects = await projectsResponse.json();
          if (Array.isArray(projects) && projects.length > 0) {
            organizationId = projects[0].organization_id;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch projects:", e);
      }
    }

    if (!organizationId) {
      throw new Error("Could not determine organization ID from Supabase API");
    }

    // Supabase doesn't provide direct user info in the API
    // We'll use the organization ID as user ID
    return {
      id: organizationId,
      email: "user@supabase.com", // Placeholder - Supabase OAuth should provide this
      name: organizationName,
    };
  }

  /**
   * Generate random state for OAuth
   */
  generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
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

export { SupabaseOAuthManager };
export type { SupabaseUser, SupabaseToken, SupabaseConfig };
