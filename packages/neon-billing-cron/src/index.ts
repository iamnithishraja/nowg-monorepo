import { serve } from "@hono/node-server";
import { Hono } from "hono";
import * as cron from "node-cron";
import { connectToDatabase } from "./lib/mongo.js";
import { getEnvWithDefault, loadEnvFromDatabase, waitForEnvLoad } from "./lib/env.js";
import { runHourlyBillingJob } from "./services/neonBillingService.js";

const app = new Hono();
let neonBillingTask: cron.ScheduledTask | null = null;

// Root endpoint
app.get("/", (c) => {
  return c.json({
    name: "Neon Billing Cron Service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      status: "GET /status",
      trigger: "POST /trigger",
    },
  });
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    cronJob: {
      scheduled: neonBillingTask !== null,
      enabled: neonBillingTask !== null,
    },
  });
});

// Manual trigger endpoint (for testing/debugging)
app.post("/trigger", async (c) => {
  try {
    console.log("[NeonBilling] Manual trigger requested");
    const startTime = Date.now();
    const result = await runHourlyBillingJob();
    const duration = Date.now() - startTime;

    return c.json({
      success: result.success,
      processed: result.processedCount,
      billed: result.billedCount,
      totalBilledAmount: result.totalBilledAmount,
      errors: result.errors,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[NeonBilling] Manual trigger failed:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

// Status endpoint
app.get("/status", async (c) => {
  try {
    await loadEnvFromDatabase();
    const neonApiKey = getEnvWithDefault("NEON_API_KEY", "");
    const enableNeonBilling = getEnvWithDefault("ENABLE_NEON_BILLING", "true");
    const effectiveNeonApiKey = neonApiKey || process.env.NEON_API_KEY || "";

    // Calculate next run time (next hour at :00)
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(nextRun.getHours() + 1);
    nextRun.setMinutes(0, 0, 0);

    return c.json({
      initialized: neonBillingTask !== null,
      neonBillingEnabled: !!effectiveNeonApiKey && enableNeonBilling === "true",
      nextNeonBillingRun:
        neonBillingTask ? nextRun.toISOString() : undefined,
      config: {
        hasNeonApiKey: !!effectiveNeonApiKey,
        enableNeonBilling,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to get status",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * Initialize the cron job scheduler
 */
async function initializeScheduler(): Promise<void> {
  // Ensure database connection and env vars are loaded
  try {
    await connectToDatabase();
    // Wait for env vars to load (with retry mechanism)
    const envLoaded = await waitForEnvLoad(10000, 500);
    if (!envLoaded) {
      console.warn(
        "[Scheduler] Env vars not fully loaded from database, will use process.env fallback"
      );
    }
  } catch (error) {
    console.error("[Scheduler] Failed to load env vars from database:", error);
    // Continue anyway - will use process.env fallback
  }

  // Check if Neon billing is configured (now from MongoDB)
  const neonApiKey = getEnvWithDefault("NEON_API_KEY", "");
  const enableNeonBilling = getEnvWithDefault("ENABLE_NEON_BILLING", "true");

  // Also check process.env as fallback if MongoDB doesn't have it
  const effectiveNeonApiKey = neonApiKey || process.env.NEON_API_KEY || "";

  if (effectiveNeonApiKey && enableNeonBilling === "true") {
    // Schedule Neon billing job to run every hour at minute 0
    // Cron expression: "0 * * * *" = at minute 0 of every hour
    neonBillingTask = cron.schedule(
      "0 * * * *",
      async () => {
        console.log("[Scheduler] Running Neon billing job...");
        try {
          const result = await runHourlyBillingJob();
          if (result.errors.length > 0) {
            console.warn(
              `[Scheduler] Neon billing job had ${result.errors.length} errors:`,
              result.errors.slice(0, 5)
            );
          } else {
            console.log(
              `[Scheduler] Neon billing job completed successfully: processed=${result.processedCount}, billed=${result.billedCount}`
            );
          }
        } catch (error) {
          console.error("[Scheduler] Neon billing job failed:", error);
        }
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );
    console.log("[Scheduler] Neon billing cron job scheduled (runs every hour at :00 UTC)");
  } else {
    const reason = !effectiveNeonApiKey
      ? "missing NEON_API_KEY"
      : enableNeonBilling !== "true"
      ? `ENABLE_NEON_BILLING=${enableNeonBilling} (expected "true")`
      : "unknown";
    console.warn(`[Scheduler] Neon billing cron job not scheduled: ${reason}`);
  }
}

/**
 * Stop all scheduled jobs
 * Call this on graceful shutdown
 */
function stopScheduler(): void {
  if (neonBillingTask) {
    neonBillingTask.stop();
    neonBillingTask = null;
    console.log("[Scheduler] Neon billing cron job stopped");
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down gracefully...");
  stopScheduler();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down gracefully...");
  stopScheduler();
  process.exit(0);
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: `Route ${c.req.method} ${c.req.path} not found`,
      availableEndpoints: {
        health: "GET /health",
        status: "GET /status",
        trigger: "POST /trigger",
      },
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error("[Server] Error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

// Start the server
const port = parseInt(process.env.PORT || "3001", 10);

async function start() {
  try {
    // Initialize scheduler before starting server
    await initializeScheduler();

    // Start Hono server
    serve({
      fetch: app.fetch,
      port,
    });

    console.log(`[Server] Neon billing cron service started on port ${port}`);
    console.log(`[Server] Health check: http://localhost:${port}/health`);
    console.log(`[Server] Status: http://localhost:${port}/status`);
    console.log(`[Server] Manual trigger: POST http://localhost:${port}/trigger`);
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

start();
