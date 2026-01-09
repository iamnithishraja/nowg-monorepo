import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Github } from "lucide-react";
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

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
}

export default function GitHubImportModal({
  isOpen,
  onClose,
  selectedModel,
}: GitHubImportModalProps) {
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isImportingRepo, setIsImportingRepo] = useState(false);
  const navigate = useNavigate();

  const checkGitHubAuth = async () => {
    try {
      const response = await fetch("/api/github/import?action=status");
      const data = await response.json();
      setIsGitHubConnected(data.isAuthenticated);
      setGithubUser(data.user);
      return data.isAuthenticated;
    } catch (error) {
      console.error("Failed to check GitHub auth:", error);
      return false;
    }
  };

  const connectGitHub = async () => {
    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start-auth" }),
      });
      const data = await response.json();
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Failed to connect GitHub:", error);
    }
  };

  const fetchGitHubRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const response = await fetch("/api/github/import?action=repositories");
      const data = await response.json();
      if (data.success) {
        setGithubRepos(data.repositories || []);
      }
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const importGitHubRepo = async () => {
    if (!selectedRepo) return;

    setIsImportingRepo(true);
    try {
      // Step 1: Import the repository files
      const importResponse = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
              importedFiles: importData.files,
              repoUrl: selectedRepo,
              projectCommands: importData.projectCommands,
            },
          });
        }
      }
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      setIsImportingRepo(false);
    }
  };

  const handleOpen = async () => {
    const isConnected = await checkGitHubAuth();
    if (isConnected) {
      fetchGitHubRepos();
    }
  };

  // Reset state when modal opens
  if (isOpen && !isGitHubConnected && !githubUser) {
    handleOpen();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="p-[1px] rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent max-w-md w-full max-h-[80vh] overflow-auto [&>button]:top-6 [&>button]:right-6 [&>button]:h-10 [&>button]:w-10 [&>button]:text-lg [&>button]:font-bold"
        showCloseButton={true}
      >
        <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
          <div className="p-6">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary-light))] to-[hsl(var(--primary))] rounded-xl flex items-center justify-center shadow-lg">
                  <Github className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Import from GitHub
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Bring your projects to life
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {!isGitHubConnected ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-gradient-to-br from-muted via-muted to-muted rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Github className="w-10 h-10 text-muted-foreground" />
                </div>
                <h4 className="text-foreground font-bold mb-3 text-xl">
                  Connect your GitHub account
                </h4>
                <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                  Import your private and public repositories seamlessly and
                  start building with AI assistance
                </p>
                <Button
                  onClick={connectGitHub}
                  className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg hover:shadow-primary/20 font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02]"
                >
                  <Github className="w-5 h-5 mr-2" />
                  Connect GitHub
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {githubUser && (
                  <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/10 via-primary/10 to-primary/10 border border-primary/30 rounded-xl">
                    <div className="relative">
                      <img
                        src={githubUser.avatar_url}
                        alt={githubUser.login}
                        className="w-12 h-12 rounded-full ring-2 ring-primary/30"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-background"></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {githubUser.name || githubUser.login}
                      </p>
                      <p className="text-xs text-primary">
                        @{githubUser.login} • Connected
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Select Repository
                  </label>
                  {isLoadingRepos ? (
                    <div className="p-6 bg-gradient-to-r from-muted/80 to-muted/80 rounded-xl text-center border border-border/50">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                      <p className="text-muted-foreground text-sm">
                        Loading your repositories...
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={selectedRepo}
                      onValueChange={setSelectedRepo}
                    >
                      <SelectTrigger className="w-full bg-muted/80 border-border/50 text-foreground h-12 rounded-xl hover:bg-muted/80 transition-colors">
                        <SelectValue placeholder="Choose a repository to import" />
                      </SelectTrigger>
                      <SelectContent className="bg-background/95 backdrop-blur-sm border border-border/50 max-h-72 rounded-xl p-1 w-[var(--radix-select-trigger-width)] shadow-xl">
                        {githubRepos.map((repo) => (
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
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Button
                  onClick={importGitHubRepo}
                  disabled={isImportingRepo || !selectedRepo}
                  className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg hover:shadow-primary/20 font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                >
                  {isImportingRepo ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                      Importing Repository...
                    </div>
                  ) : (
                    "Import Repository"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
