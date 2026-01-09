import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { UserRole, DEFAULT_USER_ROLE } from "../types/roles";

// Create auth instance - will be initialized after DB connection
let authInstance: ReturnType<typeof betterAuth> | null = null;

export function initAuth() {
  if (!authInstance) {
    // Import here to avoid circular dependency
    const { getMongoClient } = require("../config/db");

    // Get the database instance from the client
    const db = getMongoClient().db("nowgai");

    // Debug: Log OAuth configuration
    console.log("🔑 OAuth Configuration:");
    console.log("  Google Client ID:", process.env.GOOGLE_CLIENT_ID ? "✅ Set" : "❌ Not set");
    console.log("  Google Client Secret:", process.env.GOOGLE_CLIENT_SECRET ? "✅ Set" : "❌ Not set");
    console.log("  GitHub Client ID:", process.env.GITHUB_CLIENT_ID ? "✅ Set" : "❌ Not set");
    console.log("  GitHub Client Secret:", process.env.GITHUB_CLIENT_SECRET ? "✅ Set" : "❌ Not set");

    authInstance = betterAuth({
      database: mongodbAdapter(db),
      baseURL: process.env.BASE_URL || "http://localhost:3000",
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
      },
      session: {
        cookieCache: {
          enabled: true,
          maxAge: 5 * 60, // 5 minutes
        },
        expiresIn: 60 * 60 * 24 * 7, // 7 days
      },
      user: {
        additionalFields: {
          role: {
            type: "string",
            defaultValue: DEFAULT_USER_ROLE,
            required: true,
            input: false, // Don't allow setting role on signup
          },
        },
      },
      socialProviders: {
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
          ? {
              google: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
redirectURI: `${process.env.BASE_URL || "http://localhost:3000"}/api/auth/callback/google`,
              },
            }
          : {}),
        ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
          ? {
              github: {
                clientId: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
redirectURI: `${process.env.BASE_URL || "http://localhost:3000"}/api/auth/callback/github`,
              },
            }
          : {}),
      },
      advanced: {
        defaultCookieAttributes: {
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        },
      },
      trustedOrigins: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "https://nowgai-admin.vercel.app",
        "https://admin.nowg.ai",
        process.env.ADMIN_FRONTEND_URL || "http://localhost:5173",
      ],
    });
  }

  return authInstance;
}

// Get the auth instance (must be initialized first)
export function getAuth() {
  if (!authInstance) {
    throw new Error("Auth not initialized. Call initAuth() first.");
  }
  return authInstance;
}

// For compatibility, export auth that throws helpful error if not initialized
export const auth = {
  get handler() {
    return getAuth().handler;
  },
  get api() {
    return getAuth().api;
  },
  get $Infer() {
    return getAuth().$Infer;
  },
};

export type Session = ReturnType<typeof getAuth> extends { $Infer: { Session: infer S } } ? S : never;
