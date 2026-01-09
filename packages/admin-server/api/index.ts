import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { corsMiddleware } from "../middleware/cors";
import { connectToDatabase } from "../config/db";
import { getSession } from "../middleware/betterAuthMiddleware";
import adminRoutes from "../routes/admin";

dotenv.config();

const app = express();

// Middleware - CORS must be first
app.use(corsMiddleware);
app.use(cookieParser());
// Body parsers with increased limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Add session middleware to all routes
app.use(getSession);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Auth routes - BetterAuth handler needs to be mounted with toNodeHandler
// Use app.all with named wildcard parameter (Express 5 syntax)
app.all("/auth/{*splat}", async (req, res, next) => {
  const { getAuth } = await import("../lib/auth");
  const { toNodeHandler } = await import("better-auth/node");

  // Intercept OAuth callbacks to redirect to frontend
  const isCallback =
    req.url.includes("/callback/google") ||
    req.url.includes("/callback/github");

  if (isCallback) {
    console.log("🔄 OAuth callback detected:", req.url);

    // Override res.redirect to capture BetterAuth's redirect and change it
    const originalRedirect = res.redirect.bind(res);
    res.redirect = function (urlOrStatus: any, url?: any) {
      console.log("🎯 BetterAuth trying to redirect to:", urlOrStatus, url);
      const frontendUrl =
        process.env.ADMIN_FRONTEND_URL || "http://localhost:5174";
      console.log(
        "✅ Redirecting to frontend instead:",
        `${frontendUrl}/admin`
      );
      // Always redirect to frontend instead of BetterAuth's default
      return originalRedirect(302, `${frontendUrl}/admin`);
    };
  }

  // Handle the auth request
  return toNodeHandler(getAuth())(req, res);
});

// Public organization invitation routes (no auth required)
app.post("/api/organizations/accept", async (req, res) => {
  const { acceptInvitation } = await import(
    "../controllers/admin/organizationsController"
  );
  return acceptInvitation(req, res);
});
app.post("/api/organizations/reject", async (req, res) => {
  const { rejectInvitation } = await import(
    "../controllers/admin/organizationsController"
  );
  return rejectInvitation(req, res);
});

// Public organization user invitation routes (no auth required)
app.post("/api/organizations/user/accept", async (req, res) => {
  const { acceptOrgUserInvitation } = await import(
    "../controllers/admin/organizationsController"
  );
  return acceptOrgUserInvitation(req, res);
});
app.post("/api/organizations/user/reject", async (req, res) => {
  const { rejectOrgUserInvitation } = await import(
    "../controllers/admin/organizationsController"
  );
  return rejectOrgUserInvitation(req, res);
});

// Public project invitation routes (no auth required)
app.post("/api/projects/accept", async (req, res) => {
  const { acceptProjectInvitation } = await import(
    "../controllers/admin/projectsController"
  );
  return acceptProjectInvitation(req, res);
});
app.post("/api/projects/reject", async (req, res) => {
  const { rejectProjectInvitation } = await import(
    "../controllers/admin/projectsController"
  );
  return rejectProjectInvitation(req, res);
});

// Admin API routes
app.use("/admin", adminRoutes);

// Initialize database connection
let dbInitialized = false;
async function initializeDatabase() {
  if (!dbInitialized) {
    await connectToDatabase();
    const { initAuth } = await import("../lib/auth");
    initAuth();
    console.log("✅ BetterAuth initialized");
    dbInitialized = true;
  }
}

// Export for Vercel serverless
export default async function handler(req: any, res: any) {
  await initializeDatabase();
  return app(req, res);
}
