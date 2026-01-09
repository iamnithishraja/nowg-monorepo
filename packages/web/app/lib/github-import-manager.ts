// GitHub Import Manager
// Handles OAuth flow specifically for repository importing functionality

import { getEnv, getEnvWithDefault } from './env';

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubToken {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubImportConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

class GitHubImportManager {
  private config: GitHubImportConfig;

  constructor() {
    this.config = {
      clientId: getEnvWithDefault("GITHUB_IMPORT_CLIENT_ID", ''),
      clientSecret: getEnvWithDefault("GITHUB_IMPORT_CLIENT_SECRET", ''),
      redirectUri: getEnvWithDefault("GITHUB_IMPORT_REDIRECT_URI", 'http://localhost:5173/api/github/import/callback'),
      scopes: ['repo', 'delete_repo', 'user:email', 'read:user']
    };
  }

  /**
   * Generate OAuth URL for GitHub import authentication
   */
  generateOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<GitHubToken> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const tokenData = await response.json();

    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    return tokenData;
  }

  /**
   * Get user information from GitHub API
   */
  async getUserInfo(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'github-import-manager',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Generate random state for OAuth
   */
  generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create authenticated fetch function
   */
  createAuthenticatedFetch(accessToken: string): (url: string, options?: RequestInit) => Promise<Response> {
    return async (url: string, options: RequestInit = {}) => {
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'github-import-manager',
        ...options.headers,
      };

      return fetch(url, {
        ...options,
        headers,
      });
    };
  }
}

export { GitHubImportManager };
export type { GitHubUser, GitHubToken, GitHubImportConfig };
