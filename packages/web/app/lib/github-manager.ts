// GitHub Authorization Manager
// Handles OAuth flow, token management, and authentication for GitHub repository access

// Types and Interfaces
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
    expires_in?: number;
    refresh_token?: string;
}

interface GitHubApp {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
}

interface AuthConfig {
    githubApp: GitHubApp;
    storageKey?: string;
    tokenRefreshThreshold?: number; // minutes before expiry to refresh
}

interface StoredAuth {
    token: GitHubToken;
    user: GitHubUser;
    expiresAt: number;
    createdAt: number;
}

interface RepositoryAccess {
    owner: string;
    repo: string;
    permissions: {
        admin: boolean;
        push: boolean;
        pull: boolean;
    };
}

class GitHubAuthManager {
    private config: AuthConfig;
    private currentAuth: StoredAuth | null = null;

    constructor(config: AuthConfig) {
        this.config = {
            storageKey: 'github_auth',
            tokenRefreshThreshold: 5, // 5 minutes before expiry
            ...config,
        };

        // Load existing auth from storage
        this.loadStoredAuth();
    }

    /**
     * Get OAuth URL without redirecting (for API use)
     */
    getOAuthUrl(): string {
        const { clientId, redirectUri, scopes } = this.config.githubApp;

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scopes.join(' '),
            state: this.generateState(),
        });

        const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

        // Store state for verification
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('github_oauth_state', params.get('state')!);
        }

        return authUrl;
    }

    /**
     * Start OAuth flow - redirect user to GitHub
     */
    startOAuthFlow(): void {
        const authUrl = this.getOAuthUrl();
        // Redirect to GitHub
        if (typeof window !== 'undefined') {
            window.location.href = authUrl;
        }
    }

    /**
     * Handle OAuth callback - exchange code for token
     */
    async handleOAuthCallback(code: string, state: string): Promise<GitHubUser> {
        // Verify state parameter
        const storedState = sessionStorage.getItem('github_oauth_state');
        if (!storedState || storedState !== state) {
            throw new Error('Invalid state parameter - possible CSRF attack');
        }

        // Clear stored state
        sessionStorage.removeItem('github_oauth_state');

        try {
            // Exchange code for token
            const token = await this.exchangeCodeForToken(code);

            // Get user info
            const user = await this.getUserInfo(token.access_token);

            // Store authentication
            this.storeAuth(token, user);

            return user;
        } catch (error) {
            console.error('OAuth callback failed:', error);
            throw new Error('Failed to complete OAuth flow');
        }
    }

    /**
     * Exchange authorization code for access token
     */
    private async exchangeCodeForToken(code: string): Promise<GitHubToken> {
        const { clientId, clientSecret, redirectUri } = this.config.githubApp;

        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
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
    private async getUserInfo(accessToken: string): Promise<GitHubUser> {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'github-auth-manager',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        if (!this.currentAuth) {
            return false;
        }

        // Check if token is expired
        if (this.isTokenExpired()) {
            this.clearAuth();
            return false;
        }

        return true;
    }

    /**
     * Disconnect and clear stored authentication
     */
    disconnect(): void {
        this.currentAuth = null;
        // Only try to access localStorage if we're in a browser environment
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.config.storageKey!);
        }
    }

    /**
     * Get current access token
     */
    getAccessToken(): string | null {
        if (!this.isAuthenticated()) {
            return null;
        }

        return this.currentAuth!.token.access_token;
    }

    /**
     * Get current user info
     */
    getCurrentUser(): GitHubUser | null {
        if (!this.isAuthenticated()) {
            return null;
        }

        return this.currentAuth!.user;
    }

    /**
     * Check repository access permissions
     */
    async checkRepositoryAccess(owner: string, repo: string): Promise<RepositoryAccess | null> {
        if (!this.isAuthenticated()) {
            return null;
        }

        try {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAccessToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'github-auth-manager',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null; // Repository not found or no access
                }
                throw new Error(`Failed to check repository access: ${response.status}`);
            }

            const repoData = await response.json();

            return {
                owner: repoData.owner.login,
                repo: repoData.name,
                permissions: {
                    admin: repoData.permissions?.admin || false,
                    push: repoData.permissions?.push || false,
                    pull: repoData.permissions?.pull || false,
                },
            };
        } catch (error) {
            console.error('Error checking repository access:', error);
            return null;
        }
    }

    /**
     * List user's repositories
     */
    async getUserRepositories(visibility: 'all' | 'public' | 'private' = 'all'): Promise<any[]> {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        try {
            const response = await fetch(`https://api.github.com/user/repos?visibility=${visibility}&sort=updated&per_page=100`, {
                headers: {
                    'Authorization': `Bearer ${this.getAccessToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'github-auth-manager',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get repositories: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting user repositories:', error);
            throw error;
        }
    }

    /**
     * Search repositories
     */
    async searchRepositories(query: string, user?: string): Promise<any[]> {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        try {
            let searchQuery = query;
            if (user) {
                searchQuery = `${query} user:${user}`;
            }

            const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=updated&per_page=50`, {
                headers: {
                    'Authorization': `Bearer ${this.getAccessToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'github-auth-manager',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to search repositories: ${response.status}`);
            }

            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error('Error searching repositories:', error);
            throw error;
        }
    }

    /**
     * Get repository contents (for private repos)
     */
    async getRepositoryContents(owner: string, repo: string, path: string = ''): Promise<any> {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.getAccessToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'github-auth-manager',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get repository contents: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting repository contents:', error);
            throw error;
        }
    }

    /**
     * Refresh access token (if refresh token is available)
     */
    async refreshToken(): Promise<boolean> {
        if (!this.currentAuth?.token.refresh_token) {
            return false;
        }

        try {
            // Note: GitHub doesn't provide refresh tokens for OAuth apps
            // This is a placeholder for future implementation

            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            return false;
        }
    }

    /**
     * Logout user
     */
    logout(): void {
        this.clearAuth();
    }

    /**
     * Store authentication data
     */
    private storeAuth(token: GitHubToken, user: GitHubUser): void {
        const expiresAt = token.expires_in
            ? Date.now() + (token.expires_in * 1000)
            : Date.now() + (8 * 60 * 60 * 1000); // Default 8 hours

        this.currentAuth = {
            token,
            user,
            expiresAt,
            createdAt: Date.now(),
        };

        // Store in localStorage
        localStorage.setItem(this.config.storageKey!, JSON.stringify(this.currentAuth));
    }

    /**
     * Load stored authentication
     */
    private loadStoredAuth(): void {
        try {
            // Only try to access localStorage if we're in a browser environment
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem(this.config.storageKey!);
                if (stored) {
                    this.currentAuth = JSON.parse(stored);

                    // Check if expired
                    if (this.isTokenExpired()) {
                        this.clearAuth();
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load stored auth:', error);
            this.clearAuth();
        }
    }

    /**
     * Clear authentication data
     */
    private clearAuth(): void {
        this.currentAuth = null;
        // Only try to access localStorage if we're in a browser environment
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.config.storageKey!);
        }
    }

    /**
     * Check if token is expired
     */
    private isTokenExpired(): boolean {
        if (!this.currentAuth) {
            return true;
        }

        const now = Date.now();
        const threshold = this.config.tokenRefreshThreshold! * 60 * 1000; // Convert to milliseconds

        return now >= (this.currentAuth.expiresAt - threshold);
    }

    /**
     * Generate random state for OAuth
     */
    private generateState(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Create authenticated fetch function
     */
    createAuthenticatedFetch(): (url: string, options?: RequestInit) => Promise<Response> {
        return async (url: string, options: RequestInit = {}) => {
            if (!this.isAuthenticated()) {
                throw new Error('User not authenticated');
            }

            const headers = {
                'Authorization': `Bearer ${this.getAccessToken()}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'github-auth-manager',
                ...options.headers,
            };

            return fetch(url, {
                ...options,
                headers,
            });
        };
    }

    /**
     * Get authentication status info
     */
    getAuthStatus(): {
        isAuthenticated: boolean;
        user: GitHubUser | null;
        tokenExpiresAt: number | null;
        scopes: string[];
    } {
        return {
            isAuthenticated: this.isAuthenticated(),
            user: this.getCurrentUser(),
            tokenExpiresAt: this.currentAuth?.expiresAt || null,
            scopes: this.currentAuth?.token.scope?.split(' ') || [],
        };
    }
}

// Utility functions for common GitHub operations
export class GitHubUtils {
    /**
     * Parse GitHub repository URL
     */
    static parseRepoUrl(url: string): { owner: string; repo: string; branch?: string } | null {
        // Remove .git suffix if present
        url = url.replace(/\.git$/, '');

        let match;

        // GitHub SSH format: git@github.com:owner/repo.git
        if (url.startsWith('git@github.com:')) {
            match = url.match(/git@github\.com:([^\/]+)\/([^#]+)(?:#(.+))?/);
        }
        // GitHub HTTPS format: https://github.com/owner/repo
        else if (url.includes('github.com')) {
            match = url.match(/github\.com[/:]([^\/]+)\/([^#\/]+)(?:#(.+))?/);
        }
        // Direct format: owner/repo
        else {
            match = url.match(/^([^\/]+)\/([^#]+)(?:#(.+))?$/);
        }

        if (!match) {
            return null;
        }

        return {
            owner: match[1],
            repo: match[2],
            branch: match[3],
        };
    }

    /**
     * Validate GitHub repository URL
     */
    static isValidRepoUrl(url: string): boolean {
        return this.parseRepoUrl(url) !== null;
    }

    /**
     * Format repository URL
     */
    static formatRepoUrl(owner: string, repo: string, branch?: string): string {
        const baseUrl = `https://github.com/${owner}/${repo}`;
        return branch ? `${baseUrl}#${branch}` : baseUrl;
    }

    /**
     * Get repository API URL
     */
    static getRepoApiUrl(owner: string, repo: string): string {
        return `https://api.github.com/repos/${owner}/${repo}`;
    }

    /**
     * Check if repository is private (requires authentication)
     */
    static async isPrivateRepository(owner: string, repo: string, authManager: GitHubAuthManager): Promise<boolean> {
        if (!authManager.isAuthenticated()) {
            return false; // Can't check without auth
        }

        try {
            const access = await authManager.checkRepositoryAccess(owner, repo);
            return access !== null; // If we can access it, it might be private
        } catch (error) {
            return false;
        }
    }
}

// Export the classes and types
export { GitHubAuthManager };
export type {
    GitHubUser,
    GitHubToken,
    GitHubApp,
    AuthConfig,
    StoredAuth,
    RepositoryAccess
};

// Example usage:

const getEnvVar = (key: string, fallback: string = ''): string => {
  return (
    process.env[key] ||
    process.env[`VITE_${key}`] ||
    fallback
  );
};

// Example usage (should be in your application code):
// const authManager = new GitHubAuthManager({
//   githubApp: {
//     clientId: getEnvVar('GITHUB_ID'),
//     clientSecret: getEnvVar('GITHUB_SECRET'),
//     redirectUri: getEnvVar('GITHUB_REDIRECT_URI', 'http://localhost:3000/auth/github/callback'),
//     scopes: getEnvVar('GITHUB_SCOPES', 'repo,user,read:org').split(',')
//   },
//   storageKey: getEnvVar('GITHUB_STORAGE_KEY', 'github_auth'),
//   tokenRefreshThreshold: parseInt(getEnvVar('GITHUB_TOKEN_REFRESH_THRESHOLD', '5'))
// });
//
// // Check if user is authenticated
// if (!authManager.isAuthenticated()) {
//     // Start OAuth flow
//     authManager.startOAuthFlow();
// } else {
//     // User is authenticated
//     const user = authManager.getCurrentUser();
//     console.log('Authenticated as:', user?.login);
//
//     // Check repository access
//     const access = await authManager.checkRepositoryAccess('owner', 'repo');
//     if (access) {
//         console.log('Repository access:', access.permissions);
//     }
//
//     // Get user's repositories
//     const repos = await authManager.getUserRepositories('all');
//     console.log('User repositories:', repos);
// }

// Example OAuth callback handling (should be in your callback route):
// const urlParams = new URLSearchParams(window.location.search);
// const code = urlParams.get('code');
// const state = urlParams.get('state');
//
// if (code && state) {
//     try {
//         const authManager = new GitHubAuthManager(config);
//         const user = await authManager.handleOAuthCallback(code, state);
//         console.log('OAuth successful, user:', user);
//         // Redirect to main app
//     } catch (error) {
//         console.error('OAuth failed:', error);
//     }
// }

// Example usage (should be in your application code):
// const authManager = new GitHubAuthManager(config);
// const authenticatedFetch = authManager.createAuthenticatedFetch();
//
// // Use with GitHub API
// const response = await authenticatedFetch('https://api.github.com/user/repos');
// const repos = await response.json();
//
// // Utility functions
// const repoInfo = GitHubUtils.parseRepoUrl('https://github.com/owner/repo');
// if (repoInfo) {
//     console.log('Repository:', repoInfo.owner, repoInfo.repo);
// }
//
// const isValid = GitHubUtils.isValidRepoUrl('owner/repo');
// console.log('Valid URL:', isValid);

