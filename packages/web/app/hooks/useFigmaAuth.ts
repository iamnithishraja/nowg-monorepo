import { useState, useEffect, useCallback } from "react";

interface FigmaUser {
  id: string;
  email: string;
}

interface FigmaAuthState {
  isCheckingToken: boolean;
  hasFigmaConnected: boolean;
  figmaUser: FigmaUser | null;
  connectedAt: string | null;
}

export function useFigmaAuth(): FigmaAuthState & {
  checkFigmaToken: () => Promise<void>;
  handleConnectFigma: () => void;
  handleDisconnectFigma: () => Promise<void>;
} {
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [hasFigmaConnected, setHasFigmaConnected] = useState(false);
  const [figmaUser, setFigmaUser] = useState<FigmaUser | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);

  const checkFigmaToken = useCallback(async () => {
    setIsCheckingToken(true);
    try {
      const response = await fetch("/api/figma/token", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        if (data.connected) {
          setHasFigmaConnected(true);
          setFigmaUser({
            id: data.figmaUserId,
            email: data.figmaEmail,
          });
          setConnectedAt(data.connectedAt || null);
        } else {
          setHasFigmaConnected(false);
          setFigmaUser(null);
          setConnectedAt(null);
        }
      } else {
        setHasFigmaConnected(false);
        setFigmaUser(null);
        setConnectedAt(null);
      }
    } catch (err) {
      console.error("Error checking Figma token:", err);
      setHasFigmaConnected(false);
      setFigmaUser(null);
      setConnectedAt(null);
    } finally {
      setIsCheckingToken(false);
    }
  }, []);

  useEffect(() => {
    checkFigmaToken();
  }, [checkFigmaToken]);

  // Handle return from Figma OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get("figma_connected") === "true") {
      // Remove the query parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      setTimeout(() => {
        checkFigmaToken();
      }, 500);
    }

    if (urlParams.get("figma_error")) {
      const error = urlParams.get("figma_error");
      const errorDesc = urlParams.get("error_desc");
      console.error("Figma connection error:", error, errorDesc);
      // Remove the query parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [checkFigmaToken]);

  const handleConnectFigma = () => {
    // Redirect to connect endpoint which will redirect to Figma OAuth
    window.location.href = "/api/figma/connect";
  };

  const handleDisconnectFigma = async () => {
    try {
      const response = await fetch("/api/figma/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        setHasFigmaConnected(false);
        setFigmaUser(null);
        setConnectedAt(null);
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (err) {
      console.error("Failed to disconnect Figma:", err);
      throw err;
    }
  };

  return {
    isCheckingToken,
    hasFigmaConnected,
    figmaUser,
    connectedAt,
    checkFigmaToken,
    handleConnectFigma,
    handleDisconnectFigma,
  };
}
