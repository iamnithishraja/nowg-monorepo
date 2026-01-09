import { getEnv } from "./env";
import crypto from "crypto";

// Types
interface FileContent {
  path: string;
  content: string;
}

interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

interface CreateRepoResponse {
  success: boolean;
  repoName?: string;
  repoFullName?: string;
  repoUrl?: string;
  owner?: string;
  error?: string;
}

interface PushCodeOptions {
  owner: string;
  repo: string;
  branch?: string;
  files: FileContent[];
  commitMessage: string;
  accessToken: string;
}

interface PushCodeResponse {
  success: boolean;
  commitSha?: string;
  commitUrl?: string;
  error?: string;
}

interface SyncStatus {
  isSynced: boolean;
  currentHash: string;
  lastSyncedHash?: string;
}

/**
 * GitHub Repository Service
 * Handles creating repos and pushing code to GitHub
 */
export class GitHubRepositoryService {
  private githubApiUrl = "https://api.github.com";
  private userAgent = "nowgai-github-service";

  /**
   * Create a new GitHub repository
   */
  async createRepository(
    accessToken: string,
    options: CreateRepoOptions
  ): Promise<CreateRepoResponse> {
    try {
      const response = await fetch(`${this.githubApiUrl}/user/repos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": this.userAgent,
        },
        body: JSON.stringify({
          name: options.name,
          description: options.description || "Created with nowgai",
          private: options.private !== false, // Default to private
          auto_init: options.autoInit || false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error:
            errorData.message ||
            `Failed to create repository: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        repoName: data.name,
        repoFullName: data.full_name,
        repoUrl: data.html_url,
        owner: data.owner.login,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Push code to GitHub repository
   * Uses the GitHub Contents API for small repos or Tree API for larger ones
   */
  async pushCode(options: PushCodeOptions): Promise<PushCodeResponse> {
    try {
      const {
        owner,
        repo,
        branch = "main",
        files,
        commitMessage,
        accessToken,
      } = options;

      // Step 1: Get the reference (branch) to get the latest commit SHA
      const refResponse = await fetch(
        `${this.githubApiUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": this.userAgent,
          },
        }
      );

      let baseCommitSha: string;
      let baseTreeSha: string;

      if (refResponse.ok) {
        // Branch exists, get the latest commit
        const refData = await refResponse.json();
        baseCommitSha = refData.object.sha;

        // Get the tree for this commit
        const commitResponse = await fetch(
          `${this.githubApiUrl}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": this.userAgent,
            },
          }
        );

        if (!commitResponse.ok) {
          return {
            success: false,
            error: "Failed to get commit information",
          };
        }

        const commitData = await commitResponse.json();
        baseTreeSha = commitData.tree.sha;
      } else {
        // Branch doesn't exist, create initial commit
        return await this.createInitialCommit(options);
      }

      // Step 2: Create blobs for all files
      const blobPromises = files.map(async (file) => {
        const blobResponse = await fetch(
          `${this.githubApiUrl}/repos/${owner}/${repo}/git/blobs`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
              "User-Agent": this.userAgent,
            },
            body: JSON.stringify({
              content: Buffer.from(file.content).toString("base64"),
              encoding: "base64",
            }),
          }
        );

        if (!blobResponse.ok) {
          const errorText = await blobResponse.text();
          throw new Error(
            `Failed to create blob for ${file.path}: ${errorText}`
          );
        }

        const blobData = await blobResponse.json();
        return {
          path: file.path.startsWith("/") ? file.path.slice(1) : file.path,
          mode: "100644", // Regular file
          type: "blob",
          sha: blobData.sha,
        };
      });

      const tree = await Promise.all(blobPromises);

      // Step 3: Create a new tree
      const treeResponse = await fetch(
        `${this.githubApiUrl}/repos/${owner}/${repo}/git/trees`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": this.userAgent,
          },
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: tree,
          }),
        }
      );

      if (!treeResponse.ok) {
        const errorData = await treeResponse.json();
        return {
          success: false,
          error: errorData.message || "Failed to create tree",
        };
      }

      const treeData = await treeResponse.json();

      // Step 4: Create a new commit
      const commitResponse = await fetch(
        `${this.githubApiUrl}/repos/${owner}/${repo}/git/commits`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": this.userAgent,
          },
          body: JSON.stringify({
            message: commitMessage,
            tree: treeData.sha,
            parents: [baseCommitSha],
          }),
        }
      );

      if (!commitResponse.ok) {
        const errorData = await commitResponse.json();
        return {
          success: false,
          error: errorData.message || "Failed to create commit",
        };
      }

      const commitData = await commitResponse.json();

      // Step 5: Update the reference to point to the new commit
      const updateRefResponse = await fetch(
        `${this.githubApiUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": this.userAgent,
          },
          body: JSON.stringify({
            sha: commitData.sha,
            force: false,
          }),
        }
      );

      if (!updateRefResponse.ok) {
        const errorData = await updateRefResponse.json();
        return {
          success: false,
          error: errorData.message || "Failed to update branch reference",
        };
      }

      return {
        success: true,
        commitSha: commitData.sha,
        commitUrl: commitData.html_url,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Create initial commit for a new repository using Contents API
   * (Git Data API doesn't work on empty repos)
   */
  private async createInitialCommit(
    options: PushCodeOptions
  ): Promise<PushCodeResponse> {
    try {
      const {
        owner,
        repo,
        branch = "main",
        files,
        commitMessage,
        accessToken,
      } = options;

      // For empty repos, we need to use the Contents API to create files
      // We'll batch all files in a single commit by creating them sequentially
      // but GitHub will group them if we're fast enough

      let lastCommitSha: string | undefined;
      let commitUrl: string | undefined;

      // Sort files to create package.json first (good practice)
      const sortedFiles = [...files].sort((a, b) => {
        if (a.path.includes("package.json")) return -1;
        if (b.path.includes("package.json")) return 1;
        return a.path.localeCompare(b.path);
      });

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        const filePath = file.path.startsWith("/")
          ? file.path.slice(1)
          : file.path;

        const response = await fetch(
          `${this.githubApiUrl}/repos/${owner}/${repo}/contents/${filePath}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
              "User-Agent": this.userAgent,
            },
            body: JSON.stringify({
              message: i === 0 ? commitMessage : `Add ${filePath}`,
              content: Buffer.from(file.content).toString("base64"),
              branch: branch,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          return {
            success: false,
            error: `Failed to create ${filePath}: ${errorData.message}`,
          };
        }

        const data = await response.json();
        lastCommitSha = data.commit?.sha;
        commitUrl = data.commit?.html_url;
      }
      return {
        success: true,
        commitSha: lastCommitSha,
        commitUrl: commitUrl,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Calculate hash of code files to detect changes
   */
  calculateCodeHash(files: FileContent[]): string {
    // Sort files by path for consistent hashing
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    // Create a string representation of all files
    const filesString = sortedFiles
      .map((f) => `${f.path}:${f.content}`)
      .join("|");

    // Create SHA256 hash
    return crypto.createHash("sha256").update(filesString).digest("hex");
  }

  /**
   * Check if code is synced with repository
   */
  checkSyncStatus(currentHash: string, lastSyncedHash?: string): SyncStatus {
    return {
      isSynced: currentHash === lastSyncedHash,
      currentHash,
      lastSyncedHash,
    };
  }

  /**
   * Get user's GitHub username
   */
  async getGitHubUser(
    accessToken: string
  ): Promise<{ login: string; id: number } | null> {
    try {
      const response = await fetch(`${this.githubApiUrl}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        login: data.login,
        id: data.id,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if repository exists
   */
  async checkRepositoryExists(
    accessToken: string,
    owner: string,
    repo: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.githubApiUrl}/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": this.userAgent,
          },
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export type {
  FileContent,
  CreateRepoOptions,
  CreateRepoResponse,
  PushCodeOptions,
  PushCodeResponse,
  SyncStatus,
};
