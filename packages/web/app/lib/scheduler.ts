import * as cron from "node-cron";
import { publishActiveConnections } from "./cloudwatch-metrics";
import { getEnvWithDefault, loadEnvFromDatabase, waitForEnvLoad } from "./env";
import { runHourlyBillingJob } from "./neonBillingService";
import { connectToDatabase } from "./mongo";
import { getActiveStreamCount } from "./streamConnectionTracker";

let isSchedulerInitialized = false;
let neonBillingTask: cron.ScheduledTask | null = null;
let cloudWatchIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize all scheduled jobs
 * This should be called once when the server starts
 * Now async to ensure MongoDB env vars are loaded first
 */
export async function initializeScheduler(): Promise<void> {
  // Prevent multiple initializations
  if (isSchedulerInitialized) {
    return;
  }

  

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
        
        try {
          const result = await runHourlyBillingJob();
          if (result.errors.length > 0) {
            console.warn(
              `[Scheduler] Neon billing job had ${result.errors.length} errors:`,
              result.errors.slice(0, 5)
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
  } else {
    const reason = !effectiveNeonApiKey
      ? "missing NEON_API_KEY"
      : enableNeonBilling !== "true"
      ? `ENABLE_NEON_BILLING=${enableNeonBilling} (expected "true")`
      : "unknown";
    
  }

  // CloudWatch: push active stream connection count every 1 minute (when an AWS region is set)
  const awsRegion =
    getEnvWithDefault("AWS_REGION", "") ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "";
  if (awsRegion) {
    cloudWatchIntervalId = setInterval(async () => {
      try {
        const count = getActiveStreamCount();
        await publishActiveConnections(count);
      } catch (error) {
        console.error("[Scheduler] CloudWatch metric publish failed:", error);
      }
    }, 60_000); // 1 minute
  }

  isSchedulerInitialized = true;
}

/**
 * Stop all scheduled jobs
 * Call this on graceful shutdown
 */
export function stopScheduler(): void {
  if (cloudWatchIntervalId) {
    clearInterval(cloudWatchIntervalId);
    cloudWatchIntervalId = null;
  }

  if (neonBillingTask) {
    neonBillingTask.stop();
    neonBillingTask = null;
  }

  isSchedulerInitialized = false;
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return isSchedulerInitialized;
}

/**
 * Get scheduler status
 */
export async function getSchedulerStatus(): Promise<{
  initialized: boolean;
  neonBillingEnabled: boolean;
  nextNeonBillingRun?: string;
}> {
  // Ensure env vars are loaded before checking
  try {
    await loadEnvFromDatabase();
  } catch (error) {
    console.error("[Scheduler] Failed to reload env vars:", error);
  }

  const neonApiKey = getEnvWithDefault("NEON_API_KEY", "");
  const enableNeonBilling = getEnvWithDefault("ENABLE_NEON_BILLING", "true");

  // Also check process.env as fallback if MongoDB doesn't have it
  const effectiveNeonApiKey = neonApiKey || process.env.NEON_API_KEY || "";

  // Calculate next run time (next hour at :00)
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(nextRun.getHours() + 1);
  nextRun.setMinutes(0, 0, 0);

  return {
    initialized: isSchedulerInitialized,
    neonBillingEnabled: !!effectiveNeonApiKey && enableNeonBilling === "true",
    nextNeonBillingRun:
      neonBillingTask && isSchedulerInitialized
        ? nextRun.toISOString()
        : undefined,
  };
}
