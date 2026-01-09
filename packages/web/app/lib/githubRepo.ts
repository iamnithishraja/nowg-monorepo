import JSZip from "jszip";
import { getEnv } from "./env";

// Types and Interfaces
interface FileContent {
  path: string;
  content: string;
}

interface ProjectCommands {
  type: string;
  setupCommand?: string;
  startCommand?: string;
  followupMessage: string;
}

interface ImportResult {
  success: boolean;
  files: FileContent[];
  projectCommands?: ProjectCommands;
  error?: string;
  workdir?: string;
}

interface GitAuth {
  username: string;
  password: string;
}

interface GitCloneResult {
  workdir: string;
  data: Record<string, { data: any; encoding?: string }>;
}

// Configuration
interface GitHubImporterConfig {
  githubToken?: string;
  useCloudflare?: boolean;
  corsProxy?: string;
  userAgent?: string;
  maxFileSize?: number;
  maxTotalSize?: number;
  maxFiles?: number;
}

const IGNORE_PATTERNS = [
  "node_modules/**",
  ".git/**",
  ".github/**",
  ".vscode/**",
  "dist/**",
  "build/**",
  ".next/**",
  "coverage/**",
  ".cache/**",
  ".idea/**",
  "**/*.log",
  "**/.DS_Store",
  "**/npm-debug.log*",
  "**/yarn-debug.log*",
  "**/yarn-error.log*",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.png",
  // Keep lock files for faster installs
  // '**/*lock.json',
  // '**/*lock.yaml',
];

class GitHubRepoImporter {
  private config: GitHubImporterConfig;
  private savedCredentials: Map<string, GitAuth> = new Map();

  constructor(config: GitHubImporterConfig = {}) {
    this.config = {
      githubToken:
        getEnv("GITHUB_TOKEN") || getEnv("VITE_GITHUB_ACCESS_TOKEN") || "",
      useCloudflare: false,
      corsProxy: "/api/git-proxy",
      userAgent: "github-repo-importer",
      maxFileSize: 100 * 1024, // 100KB
      maxTotalSize: 500 * 1024, // 500KB
      maxFiles: 1000,
      ...config,
    };
  }

  /**
   * Main method to import a GitHub repository
   */
  async importRepository(repoUrl: string): Promise<ImportResult> {
    try {

      // Parse repository URL and determine method
      const { owner, repo, branch } = this.parseRepoUrl(repoUrl);

      if (!owner || !repo) {
        throw new Error("Invalid repository URL format");
      }

      // Fetch repository contents
      const files = await this.fetchRepositoryContents(owner, repo, branch);

      // Filter files based on ignore patterns
      const filteredFiles = this.filterFiles(files);

      // Detect project commands
      const projectCommands = this.detectProjectCommands(filteredFiles);

      // Convert to FileContent format
      const fileContents = this.convertToFileContents(filteredFiles);

      return {
        success: true,
        files: fileContents,
        projectCommands,
        workdir: `${owner}/${repo}`,
      };
    } catch (error) {
      console.error("Repository import failed:", error);

      return {
        success: false,
        files: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Parse GitHub repository URL
   */
  private parseRepoUrl(url: string): {
    owner: string;
    repo: string;
    branch?: string;
  } {
    // Remove .git suffix if present
    url = url.replace(/\.git$/, "");

    // Handle different URL formats
    let match;

    // GitHub SSH format: git@github.com:owner/repo.git
    if (url.startsWith("git@github.com:")) {
      match = url.match(/git@github\.com:([^\/]+)\/([^#]+)(?:#(.+))?/);
    }
    // GitHub HTTPS format: https://github.com/owner/repo
    else if (url.includes("github.com")) {
      match = url.match(/github\.com[/:]([^\/]+)\/([^#\/]+)(?:#(.+))?/);
    }
    // Direct format: owner/repo
    else if (!url.includes("/")) {
      throw new Error("Invalid repository URL format");
    } else {
      match = url.match(/^([^\/]+)\/([^#]+)(?:#(.+))?$/);
    }

    if (!match) {
      throw new Error("Invalid repository URL format");
    }

    return {
      owner: match[1],
      repo: match[2],
      branch: match[3],
    };
  }

  /**
   * Fetch repository contents using GitHub API
   */
  private async fetchRepositoryContents(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<any[]> {
    if (this.config.useCloudflare) {
      return await this.fetchRepoContentsCloudflare(owner, repo, branch);
    } else {
      return await this.fetchRepoContentsZip(owner, repo, branch);
    }
  }

  /**
   * Fetch repository contents using GitHub Contents API (Cloudflare compatible)
   */
  private async fetchRepoContentsCloudflare(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<any[]> {
    const baseUrl = "https://api.github.com";

    // Get repository info to find default branch
    const repoResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": this.config.userAgent!,
        ...(this.config.githubToken
          ? { Authorization: `Bearer ${this.config.githubToken}` }
          : {}),
      },
    });

    if (!repoResponse.ok) {
      throw new Error(`Repository not found: ${owner}/${repo}`);
    }

    const repoData = (await repoResponse.json()) as any;
    const targetBranch = branch || repoData.default_branch;

    // Get the tree recursively
    const treeResponse = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": this.config.userAgent!,
          ...(this.config.githubToken
            ? { Authorization: `Bearer ${this.config.githubToken}` }
            : {}),
        },
      }
    );

    if (!treeResponse.ok) {
      throw new Error(
        `Failed to fetch repository tree: ${treeResponse.status}`
      );
    }

    const treeData = (await treeResponse.json()) as any;

    // Filter for files only (not directories) and limit size
    const files = treeData.tree.filter((item: any) => {
      if (item.type !== "blob") {
        return false;
      }

      if (item.path.startsWith(".git/")) {
        return false;
      }

      // Allow lock files even if they're large
      const isLockFile =
        item.path.endsWith("package-lock.json") ||
        item.path.endsWith("yarn.lock") ||
        item.path.endsWith("pnpm-lock.yaml");

      // For non-lock files, limit size
      if (!isLockFile && item.size >= this.config.maxFileSize!) {
        return false;
      }

      return true;
    });

    // Fetch file contents in batches
    const batchSize = 10;
    const fileContents: any[] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file: any) => {
        try {
          const contentResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/contents/${file.path}`,
            {
              headers: {
                Accept: "application/vnd.github.v3+json",
                "User-Agent": this.config.userAgent!,
                ...(this.config.githubToken
                  ? { Authorization: `Bearer ${this.config.githubToken}` }
                  : {}),
              },
            }
          );

          if (!contentResponse.ok) {

            return null;
          }

          const contentData = (await contentResponse.json()) as any;
          const content = atob(contentData.content.replace(/\s/g, ""));

          return {
            name: file.path.split("/").pop() || "",
            path: file.path,
            content,
          };
        } catch (error) {

          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      fileContents.push(...batchResults.filter(Boolean));

      // Add a small delay between batches
      if (i + batchSize < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return fileContents;
  }

  /**
   * Fetch repository contents using GitHub Releases API (ZIP download)
   */
  private async fetchRepoContentsZip(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<any[]> {
    const baseUrl = "https://api.github.com";

    // Get repository info to find default branch
    const repoResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": this.config.userAgent!,
        ...(this.config.githubToken
          ? { Authorization: `Bearer ${this.config.githubToken}` }
          : {}),
      },
    });

    if (!repoResponse.ok) {
      throw new Error(
        `Repository not found: ${owner}/${repo} (${repoResponse.status})`
      );
    }

    const repoData = (await repoResponse.json()) as any;
    const targetBranch = branch || repoData.default_branch;

    // Get the zipball URL for the target branch
    const zipballUrl = `${baseUrl}/repos/${owner}/${repo}/zipball/${targetBranch}`;

    // Fetch the zipball
    const zipResponse = await fetch(zipballUrl, {
      headers: {
        ...(this.config.githubToken
          ? { Authorization: `Bearer ${this.config.githubToken}` }
          : {}),
      },
    });

    if (!zipResponse.ok) {
      const errorText = await zipResponse.text();
      console.error("Zipball error response:", errorText);
      throw new Error(
        `Failed to fetch repository zipball: ${zipResponse.status} - ${errorText}`
      );
    }

    // Get the zip content as ArrayBuffer
    const zipArrayBuffer = await zipResponse.arrayBuffer();

    // Use JSZip to extract the contents
    const zip = await JSZip.loadAsync(zipArrayBuffer);

    // Find the root folder name
    let rootFolderName = "";
    zip.forEach((relativePath) => {
      if (!rootFolderName && relativePath.includes("/")) {
        rootFolderName = relativePath.split("/")[0];
      }
    });

    // Extract all files
    const promises = Object.keys(zip.files).map(async (filename) => {
      const zipEntry = zip.files[filename];

      // Skip directories
      if (zipEntry.dir) {
        return null;
      }

      // Skip the root folder itself
      if (filename === rootFolderName) {
        return null;
      }

      // Remove the root folder from the path
      let normalizedPath = filename;

      if (rootFolderName && filename.startsWith(rootFolderName + "/")) {
        normalizedPath = filename.substring(rootFolderName.length + 1);
      }

      // Get the file content
      const content = await zipEntry.async("string");

      return {
        name: normalizedPath.split("/").pop() || "",
        path: normalizedPath,
        content,
      };
    });

    const results = await Promise.all(promises);
    return results.filter(Boolean);
  }

  /**
   * Filter files based on ignore patterns and size limits
   */
  private filterFiles(files: any[]): any[] {
    const ignorePatterns = IGNORE_PATTERNS;
    let totalSize = 0;
    const filteredFiles: any[] = [];

    for (const file of files) {
      // Check ignore patterns
      const shouldIgnore = ignorePatterns.some((pattern) => {
        if (pattern.includes("**")) {
          // Handle glob patterns
          const regex = new RegExp(
            pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
          );
          return regex.test(file.path);
        } else {
          return file.path.includes(pattern.replace("**/", ""));
        }
      });

      if (shouldIgnore) {
        continue;
      }

      // Check file size limits
      if (file.content && file.content.length > this.config.maxFileSize!) {
        continue;
      }

      // Check total size limit
      if (totalSize + (file.content?.length || 0) > this.config.maxTotalSize!) {

        break;
      }

      // Check file count limit
      if (filteredFiles.length >= this.config.maxFiles!) {

        break;
      }

      filteredFiles.push(file);
      totalSize += file.content?.length || 0;
    }

    return filteredFiles;
  }

  /**
   * Convert fetched files to FileContent format
   */
  private convertToFileContents(files: any[]): FileContent[] {
    return files.map((file) => ({
      path: file.path,
      content: file.content || "",
    }));
  }

  private detectProjectCommands(
    files: FileContent[]
  ): ProjectCommands | undefined {
    const hasFile = (name: string) => files.some((f) => f.path.endsWith(name));
    const hasFileContent = (name: string, content: string) =>
      files.some((f) => f.path.endsWith(name) && f.content.includes(content));

    if (hasFile("package.json")) {
      const packageJsonFile = files.find((f) =>
        f.path.endsWith("package.json")
      );

      if (!packageJsonFile) {
        return undefined;
      }

      try {
        const packageJson = JSON.parse(packageJsonFile.content);
        const scripts = packageJson?.scripts || {};
        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Check for preferred commands in priority order
        const preferredCommands = ["dev", "start", "preview"];
        const availableCommand = preferredCommands.find((cmd) => scripts[cmd]);

        // Build setup command with non-interactive handling
        let baseSetupCommand =
          "npx update-browserslist-db@latest && npm install";

        const setupCommand = this.makeNonInteractive(baseSetupCommand);

        if (availableCommand) {
          return {
            type: "Node.js",
            setupCommand,
            startCommand: `npm run ${availableCommand}`,
            followupMessage: `Found "${availableCommand}" script in package.json. Running "npm run ${availableCommand}" after installation.`,
          };
        }

        return {
          type: "Node.js",
          setupCommand,
          followupMessage:
            "Would you like me to inspect package.json to determine the available scripts for running this project?",
        };
      } catch (error) {
        console.error("Error parsing package.json:", error);
        return undefined;
      }
    }

    if (hasFile("index.html")) {
      return {
        type: "Static",
        startCommand: "npx --yes serve",
        followupMessage: "",
      };
    }

    return undefined;
  }

  private makeNonInteractive(command: string): string {
    // Set environment variables for non-interactive mode
    const envVars =
      "export CI=true DEBIAN_FRONTEND=noninteractive FORCE_COLOR=0";

    // Common interactive packages and their non-interactive flags
    const interactivePackages = [
      {
        pattern: /npx\s+([^@\s]+@?[^\s]*)\s+init/g,
        replacement: 'echo "y" | npx --yes $1 init --defaults --yes',
      },
      {
        pattern: /npx\s+create-([^\s]+)/g,
        replacement: "npx --yes create-$1 --template default",
      },
      {
        pattern: /npx\s+([^@\s]+@?[^\s]*)\s+add/g,
        replacement: "npx --yes $1 add --defaults --yes",
      },
      {
        pattern: /npm\s+install(?!\s+--)/g,
        replacement: "npm install --yes --no-audit --no-fund --silent",
      },
      {
        pattern: /yarn\s+add(?!\s+--)/g,
        replacement: "yarn add --non-interactive",
      },
      { pattern: /pnpm\s+add(?!\s+--)/g, replacement: "pnpm add --yes" },
    ];

    let processedCommand = command;

    // Apply replacements for known interactive patterns
    interactivePackages.forEach(({ pattern, replacement }) => {
      processedCommand = processedCommand.replace(pattern, replacement);
    });

    return `${envVars} && ${processedCommand}`;
  }

  /**
   * Create nowgai artifact message for imported files
   */
  createNowgaiArtifactMessage(
    repoUrl: string,
    files: FileContent[],
    projectCommands?: ProjectCommands
  ): string {
    const repoName = repoUrl.split("/").slice(-1)[0].replace(".git", "");

    let content = `Cloning the repo ${repoUrl}\n`;

    if (files.length > 0) {
      content += `<nowgaiArtifact id="imported-files" title="Git Cloned Files" type="bundled">
${files
  .map(
    (file) =>
      `<nowgaiAction type="file" filePath="${file.path}">
${this.escapeNowgaiTags(file.content)}
</nowgaiAction>`
  )
  .join("\n")}
</nowgaiArtifact>`;
    }

    if (
      projectCommands &&
      (projectCommands.setupCommand || projectCommands.startCommand)
    ) {
      let commandString = "";

      if (projectCommands.setupCommand) {
        commandString += `\n<nowgaiAction type="shell">${projectCommands.setupCommand}</nowgaiAction>`;
      }

      if (projectCommands.startCommand) {
        commandString += `\n<nowgaiAction type="start">${projectCommands.startCommand}</nowgaiAction>`;
      }

      content += `\n\n${projectCommands.followupMessage || ""}
<nowgaiArtifact id="project-setup" title="Project Setup">
${commandString}
</nowgaiArtifact>`;
    }

    return content;
  }

  /**
   * Escape nowgai tags in content (extracted from nowgai projectCommands.ts)
   */
  private escapeNowgaiTags(input: string): string {
    // Escape nowgaiArtifact tags (extracted from nowgai projectCommands.ts)
    const artifactRegex =
      /(<nowgaiArtifact[^>]*>)([\s\S]*?)(<\/nowgaiArtifact>)/g;
    let escaped = input.replace(
      artifactRegex,
      (match, openTag, content, closeTag) => {
        const escapedOpenTag = openTag
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const escapedCloseTag = closeTag
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `${escapedOpenTag}${content}${escapedCloseTag}`;
      }
    );

    // Escape nowgaiAction tags
    const actionRegex = /(<nowgaiAction[^>]*>)([\s\S]*?)(<\/nowgaiAction>)/g;
    escaped = escaped.replace(
      actionRegex,
      (match, openTag, content, closeTag) => {
        const escapedOpenTag = openTag
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const escapedCloseTag = closeTag
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `${escapedOpenTag}${content}${escapedCloseTag}`;
      }
    );

    return escaped;
  }

  /**
   * Set GitHub token for authentication
   */
  setGitHubToken(token: string): void {
    this.config.githubToken = token;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GitHubImporterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): GitHubImporterConfig {
    return { ...this.config };
  }
}

// Export the class and types
export { GitHubRepoImporter, IGNORE_PATTERNS };
export type {
  FileContent,
  ProjectCommands,
  ImportResult,
  GitHubImporterConfig,
  GitAuth,
  GitCloneResult,
};
