import { useState, useEffect } from "react";

interface SupabaseAuthState {
  isCheckingToken: boolean;
  hasSupabaseConnected: boolean;
  supabaseToken: string | null;
  supabaseUser: {
    id: string;
    email: string;
    name?: string;
  } | null;
  organizationId: string | null;
}

export function useSupabaseAuth(): SupabaseAuthState & {
  checkSupabaseToken: () => Promise<void>;
  handleConnectSupabase: () => Promise<void>;
  handleDisconnectSupabase: () => Promise<void>;
} {
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [hasSupabaseConnected, setHasSupabaseConnected] = useState(false);
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null);
  const [supabaseUser, setSupabaseUser] =
    useState<SupabaseAuthState["supabaseUser"]>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    checkSupabaseToken();
  }, []);

  // Handle return from Supabase OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get("supabase_connected") === "true") {
      // Remove the query parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      setTimeout(() => {
        checkSupabaseToken();
      }, 500);
    }

    if (urlParams.get("supabase_error")) {
      const error = urlParams.get("supabase_error");
      const errorDesc = urlParams.get("error_desc");
      console.error("Supabase connection error:", error, errorDesc);
      // Remove the query parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const checkSupabaseToken = async () => {
    setIsCheckingToken(true);
    try {
      const response = await fetch("/api/supabase/token", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        if (data.hasToken && data.token) {
          setSupabaseToken(data.token);
          setHasSupabaseConnected(true);
          setSupabaseUser(data.user || null);
          setOrganizationId(data.organizationId || null);
        } else {
          setHasSupabaseConnected(false);
          setSupabaseToken(null);
          setSupabaseUser(null);
          setOrganizationId(null);
        }
      }
    } catch (err) {
      setHasSupabaseConnected(false);
      setSupabaseToken(null);
      setSupabaseUser(null);
      setOrganizationId(null);
    } finally {
      setIsCheckingToken(false);
    }
  };

  const handleConnectSupabase = async () => {
    // Redirect to connect endpoint which will redirect to Supabase OAuth
    window.location.href = "/api/supabase/connect";
  };

  const handleDisconnectSupabase = async () => {
    try {
      const response = await fetch("/api/supabase/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        setHasSupabaseConnected(false);
        setSupabaseToken(null);
        setSupabaseUser(null);
        setOrganizationId(null);
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (err) {
      console.error("Failed to disconnect Supabase:", err);
      throw err;
    }
  };

  return {
    isCheckingToken,
    hasSupabaseConnected,
    supabaseToken,
    supabaseUser,
    organizationId,
    checkSupabaseToken,
    handleConnectSupabase,
    handleDisconnectSupabase,
  };
}
