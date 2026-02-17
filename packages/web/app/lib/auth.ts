import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { connectToDatabase } from "~/lib/mongo";
import { sendVerificationEmail, sendPasswordResetEmail } from "~/lib/email";
import { getEnv, getEnvWithDefault } from "~/lib/env";

let authInstance: any = null;
let mongoClient: MongoClient | null = null;

async function createAuth() {
  if (authInstance) return authInstance;

  // Ensure Mongoose connection is established for our models
  await connectToDatabase();

  // Create a separate MongoDB client for Better Auth
  const connectionString = process.env.MONGODB_URI;
  if (!connectionString) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  // Create MongoDB client for Better Auth (separate from Mongoose)
  if (!mongoClient) {
    mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
  }

  const dbName = process.env.MONGODB_DB_NAME || "nowgai";
  const db = mongoClient.db(dbName);

  authInstance = betterAuth({
    secret: getEnv("BETTER_AUTH_SECRET")!,
    baseURL: getEnvWithDefault("BETTER_AUTH_URL", "http://localhost:5173"),
    basePath: "/api/auth",
    database: mongodbAdapter(db),
    trustedOrigins: [
      getEnvWithDefault("BETTER_AUTH_URL", "http://localhost:5173"),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }: { user: any; url: string }) => {
        try {
          console.log("🔄 Sending password reset email for user:", user.email);
          await sendPasswordResetEmail({
            to: user.email,
            subject: "Reset your password - Nowgai",
            resetUrl: url,
            userName: user.name || user.email,
          });
          console.log("✅ Password reset email callback completed successfully");
        } catch (error) {
          console.error("❌ Error in sendResetPassword callback:", error);
          // Re-throw the error so Better Auth knows the email failed
          throw error;
        }
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({
        user,
        url,
      }: {
        user: any;
        url: string;
      }) => {
        await sendVerificationEmail({
          to: user.email,
          subject: "Verify your email address - Nowgai",
          verificationUrl: url,
          userName: user.name || user.email,
        });
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600, // 1 hour
    },
    socialProviders: {
      google: {
        prompt: "select_account",
        clientId: getEnv("GOOGLE_ID") as string,
        clientSecret: getEnv("GOOGLE_SECRET") as string,
      },
      github: {
        clientId: getEnv("GITHUB_CLIENT_ID") as string,
        clientSecret: getEnv("GITHUB_CLIENT_SECRET") as string,
      },
    },
    user: {
      // Add default fields to the user model
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
          required: false,
        },
      },
    },
  });

  return authInstance;
}

export async function getAuth() {
  return await createAuth();
}

// For backwards compatibility, export a promise
export const auth = createAuth();

// Export function to get the MongoDB client (for use in adminHelpers)
export async function getAuthMongoClient(): Promise<MongoClient> {
  // Ensure auth is initialized (which creates the mongoClient)
  await createAuth();
  if (!mongoClient) {
    throw new Error("MongoDB client not initialized");
  }
  return mongoClient;
}

// Cleanup function for graceful shutdown
export async function closeAuthConnection() {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
  }
}