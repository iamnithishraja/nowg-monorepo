import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { corsMiddleware } from "./middleware/cors";
import { connectToDatabase } from "./config/db";
import { getSession } from "./middleware/betterAuthMiddleware";
import adminRoutes from "./routes/admin";

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
app.all("/api/auth/{*splat}", async (req, res) => {
  const { getAuth } = await import("./lib/auth");
  const { toNodeHandler } = await import("better-auth/node");
  return toNodeHandler(getAuth())(req, res);
});

// Public organization invitation routes (no auth required)
app.post("/api/organizations/accept", async (req, res) => {
  const { acceptInvitation } = await import(
    "./controllers/admin/organizationsController"
  );
  return acceptInvitation(req, res);
});
app.post("/api/organizations/reject", async (req, res) => {
  const { rejectInvitation } = await import(
    "./controllers/admin/organizationsController"
  );
  return rejectInvitation(req, res);
});

// Public organization user invitation routes (no auth required)
app.post("/api/organizations/user/accept", async (req, res) => {
  const { acceptOrgUserInvitation } = await import(
    "./controllers/admin/organizationsController"
  );
  return acceptOrgUserInvitation(req, res);
});
app.post("/api/organizations/user/reject", async (req, res) => {
  const { rejectOrgUserInvitation } = await import(
    "./controllers/admin/organizationsController"
  );
  return rejectOrgUserInvitation(req, res);
});

// Admin API routes
app.use("/api/admin", adminRoutes);

// Connect to database and start server
async function startServer() {
  try {
    await connectToDatabase();

    // Initialize BetterAuth after DB connection
    const { initAuth } = await import("./lib/auth");
    initAuth();
    console.log("✅ BetterAuth initialized");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
