import { createAuthClient } from "better-auth/react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: API_URL,
  // After social login, BetterAuth will redirect to this URL
  // The callback happens on backend, then redirects here
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
