import { useState, useEffect } from "react";

interface GitHubAuthState {
  isCheckingToken: boolean;
  hasGitHubConnected: boolean;
  githubToken: string;
  setGithubToken: (token: string) => void;
}

export function useGitHubAuth(): GitHubAuthState & {
  checkGitHubToken: () => Promise<void>;
  handleConnectGitHub: () => Promise<void>;
} {
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [hasGitHubConnected, setHasGitHubConnected] = useState(false);
  const [githubToken, setGithubToken] = useState("");

  useEffect(() => {
    checkGitHubToken();
  }, []);

  // Handle return from GitHub OAuth
  useEffect(() => {
    const returnUrl = sessionStorage.getItem("github_repo_return_url");
    const urlParams = new URLSearchParams(window.location.search);

    if (returnUrl && urlParams.get("github_connected") === "true") {
      sessionStorage.removeItem("github_repo_return_url");
      setTimeout(() => {
        checkGitHubToken();
      }, 500);
    }
  }, []);

  const checkGitHubToken = async () => {
    setIsCheckingToken(true);
    try {
      const response = await fetch("/api/github/repository/token", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        if (data.hasToken && data.token) {
          setGithubToken(data.token);
          setHasGitHubConnected(true);
        } else {
          setHasGitHubConnected(false);
        }
      }
    } catch (err) {
      setHasGitHubConnected(false);
    } finally {
      setIsCheckingToken(false);
    }
  };

  const handleConnectGitHub = async () => {
    const response = await fetch("/api/github/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "start-auth",
      }),
    });

    const data = await response.json();
    if (data.success && data.authUrl) {
      sessionStorage.setItem("github_repo_return_url", window.location.href);
      window.location.href = data.authUrl;
    } else {
      throw new Error("Failed to start GitHub authentication");
    }
  };

  return {
    isCheckingToken,
    hasGitHubConnected,
    githubToken,
    setGithubToken,
    checkGitHubToken,
    handleConnectGitHub,
  };
}

