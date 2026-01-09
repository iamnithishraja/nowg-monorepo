import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { runHourlyBillingJob } from "~/lib/neonBillingService";

/**
 * API Route: Run Neon Hourly Billing Job
 * POST /api/neon/billing/run
 *
 * This endpoint is designed to be called by a cron job (e.g., every hour)
 * It processes usage for all active Neon projects and bills wallets accordingly.
 *
 * Authentication: Uses a secret key for cron job authentication
 * Header: x-cron-secret or Authorization: Bearer <secret>
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Verify cron secret
    const cronSecret = getEnvWithDefault("NEON_BILLING_CRON_SECRET", "");
    if (!cronSecret) {
      console.error("[NeonBilling] NEON_BILLING_CRON_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Billing job not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check authorization
    const authHeader = request.headers.get("Authorization");
    const cronSecretHeader = request.headers.get("x-cron-secret");
    const providedSecret =
      cronSecretHeader ||
      (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    if (providedSecret !== cronSecret) {
      console.warn("[NeonBilling] Unauthorized billing job attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    console.log("[NeonBilling] Starting hourly billing job...");
    const startTime = Date.now();

    // Run the billing job
    const result = await runHourlyBillingJob();

    const duration = Date.now() - startTime;

    console.log(
      `[NeonBilling] Job completed in ${duration}ms: processed=${
        result.processedCount
      }, billed=${
        result.billedCount
      }, amount=$${result.totalBilledAmount.toFixed(4)}`
    );

    return new Response(
      JSON.stringify({
        success: result.success,
        duration,
        processedCount: result.processedCount,
        billedCount: result.billedCount,
        totalBilledAmount: result.totalBilledAmount,
        errors: result.errors.length > 0 ? result.errors : undefined,
        // Don't include full results in response to keep it small
      }),
      {
        status: result.success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[NeonBilling] Error running billing job:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to run billing job",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * GET endpoint for health check / status
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return new Response(
    JSON.stringify({
      endpoint: "/api/neon/billing/run",
      method: "POST",
      description: "Run hourly Neon billing job",
      authentication: "x-cron-secret header or Bearer token",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
