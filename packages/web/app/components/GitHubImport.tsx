import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Github, Link, Unlink, Download, Search, Loader2 } from "lucide-react";
import { OPENROUTER_MODELS } from "../consts/models";

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  private: boolean;
  updated_at: string;
  language: string;
}

interface GitHubImportProps {
  onImport?: (files: any[]) => void;
  className?: string;
  selectedModel?: string;
}

export default function GitHubImport({
  onImport,
  className,
  selectedModel = OPENROUTER_MODELS[0].id,
}: GitHubImportProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Check authentication status on mount and handle OAuth callback
  useEffect(() => {
    checkAuthStatus();

    // Handle OAuth callback success/error messages
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("github_import_success");
    const error = urlParams.get("github_import_error");

    if (success === "true") {
      setMessage("GitHub account connected successfully!");
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Recheck auth status
      setTimeout(() => checkAuthStatus(), 1000);
    } else if (error) {
      setMessage(`GitHub connection failed: ${decodeURIComponent(error)}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check GitHub import session
      const response = await fetch("/api/github/import?action=status");
      const data = await response.json();

      setIsAuthenticated(data.isAuthenticated);
      setUser(data.user);

      // If authenticated, fetch repositories
      if (data.isAuthenticated) {
        fetchRepositories();
      }
    } catch (error) {
      console.error("Failed to check auth status:", error);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const fetchRepositories = async () => {
    setIsLoadingRepos(true);
    try {
      const response = await fetch("/api/github/import?action=repositories");
      const data = await response.json();

      if (data.success) {
        setRepositories(data.repositories || []);
      } else {
        setMessage(data.error || "Failed to fetch repositories");
      }
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
      setMessage("Failed to fetch repositories");
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleConnectGitHub = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "start-auth" }),
      });

      const data = await response.json();

      if (data.success && data.authUrl) {
        // Redirect to GitHub OAuth
        window.location.href = data.authUrl;
      } else {
        setMessage(data.error || "Failed to start GitHub authentication");
        setIsLoading(false);
      }
    } catch (error) {
      setMessage("Failed to connect to GitHub");
      setIsLoading(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "disconnect" }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(false);
        setUser(null);
        setMessage(data.message);
      } else {
        setMessage(data.error || "Failed to disconnect");
      }
    } catch (error) {
      setMessage("Failed to disconnect from GitHub");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportRepo = async () => {
    if (!selectedRepo) {
      setMessage("Please select a repository");
      return;
    }

    setIsImporting(true);
    setMessage("");

    try {
      // Step 1: Import the repository files
      const importResponse = await fetch("/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "import-repo",
          repoUrl: selectedRepo,
        }),
      });

      const importData = await importResponse.json();

      if (importData.success) {
        // Step 2: Create a conversation for the imported repo
        const conversationResponse = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            title: `Import: ${selectedRepo.split("/").pop()}`,
            model: selectedModel,
          }),
        });

        if (conversationResponse.ok) {
          const conversationData = await conversationResponse.json();
          const conversationId = conversationData.conversationId;

          // Step 3: Navigate to workspace with imported files
          const repoName = selectedRepo.split("/").pop() || selectedRepo;
          navigate(`/workspace?conversationId=${conversationId}`, {
            state: {
              initialPrompt: `I've imported this repository: ${selectedRepo}. Please install dependencies and start the development server now. Detect the package manager from lockfiles and use the correct install command, then run the appropriate dev/start script from package.json. Do not create or modify any files unless absolutely necessary to run the app. Stream only the shell commands/output.`,
              displayMessage: `Import GitHub repository: ${repoName}`,
              isSystemPrompt: true,
              model: selectedModel,
              importedFiles: importData.files, // Pass imported files
              repoUrl: selectedRepo,
              projectCommands: importData.projectCommands,
            },
          });
        } else {
          setMessage("Failed to create conversation. Please try again.");
        }
      } else {
        setMessage(importData.error || "Failed to import repository");
      }
    } catch (error) {
      console.error("Import error:", error);
      setMessage("Failed to import repository");
    } finally {
      setIsImporting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleImportRepo();
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Authentication Status */}
      {isAuthenticated && user ? (
        <div className="bg-gradient-to-r from-primary/10 to-primary/10 border border-primary/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-12 h-12 rounded-full ring-2 ring-primary/30"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-background"></div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Connected as {user.name || user.login}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{user.login} • GitHub
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnectGitHub}
              disabled={isLoading}
              className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/40 transition-all duration-200"
            >
              <Unlink className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-primary/10 to-primary/10 border border-primary/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-light))] rounded-xl flex items-center justify-center">
                <Github className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Connect your GitHub account
                </p>
                <p className="text-xs text-muted-foreground">
                  Import your private and public repositories seamlessly
                </p>
              </div>
            </div>
            <Button
              onClick={handleConnectGitHub}
              disabled={isLoading}
              className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-light))] hover:from-[hsl(var(--primary-light))] hover:to-[hsl(var(--primary))] shadow-lg transition-all duration-200 hover:scale-105"
            >
              <Github className="w-4 h-4 mr-2" />
              {isLoading ? "Connecting..." : "Connect GitHub"}
            </Button>
          </div>
        </div>
      )}

      {/* Repository Import */}
      {isAuthenticated && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-light))] rounded-lg flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </div>
              <div>
                <label className="text-sm font-semibold text-white">
                  Select Repository
                </label>
                <p className="text-xs text-muted-foreground">
                  Choose from your GitHub repositories
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRepositories}
              disabled={isLoadingRepos}
              className="text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all duration-200"
            >
              {isLoadingRepos ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {isLoadingRepos ? (
            <div className="bg-gradient-to-r from-muted/10 to-muted/10 border border-border/20 rounded-xl p-6">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Loading your repositories...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger className="w-full bg-muted/80 border-border/50 text-foreground h-12 rounded-xl hover:bg-muted/80 transition-colors">
                  <SelectValue placeholder="Choose a repository to import" />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-sm border border-border/50 max-h-72 rounded-xl p-1 w-[var(--radix-select-trigger-width)] shadow-xl">
                  {repositories.map((repo) => (
                    <SelectItem
                      key={repo.id}
                      value={repo.html_url}
                      className="hover:bg-accent/50 focus:bg-accent/50 rounded-lg p-2 cursor-pointer transition-colors duration-150"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-6 h-6 bg-gradient-to-br from-primary/20 to-primary/10 rounded-md flex items-center justify-center flex-shrink-0 border border-primary/20">
                          <Github className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground text-sm truncate">
                              {repo.name}
                            </span>
                            {repo.private && (
                              <span className="text-xs bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-md flex-shrink-0 border border-orange-500/20">
                                Private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-muted-foreground truncate leading-relaxed">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                                {repo.language}
                              </span>
                            )}
                            <span className="truncate">
                              Updated{" "}
                              {new Date(repo.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleImportRepo}
                disabled={isImporting || !selectedRepo}
                className="w-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-light))] hover:opacity-90 h-12 rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5 mr-2" />
                {isImporting ? "Importing Repository..." : "Import Repository"}
              </Button>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-xs text-primary flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[hsl(var(--primary))] rounded-full"></div>
              Select one of your GitHub repositories to import and start working
              with AI assistance
            </p>
          </div>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm ${
            message.includes("successfully") || message.includes("Connected")
              ? "bg-gradient-to-r from-primary/10 to-primary/10 text-primary border border-primary/20"
              : "bg-gradient-to-r from-destructive/10 to-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${
                message.includes("successfully") ||
                message.includes("Connected")
                  ? "bg-primary"
                  : "bg-destructive"
              }`}
            ></div>
            <span>{message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
