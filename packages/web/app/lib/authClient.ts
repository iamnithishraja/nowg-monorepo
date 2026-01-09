import { createAuthClient } from "better-auth/client";
import { getEnvWithDefault } from "./env";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : getEnvWithDefault("BETTER_AUTH_URL", "http://localhost:5173"),
});

export const { signIn, signOut, signUp, forgetPassword, resetPassword } =
  authClient;

