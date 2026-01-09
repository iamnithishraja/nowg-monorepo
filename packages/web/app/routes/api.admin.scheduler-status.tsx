import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getSchedulerStatus } from "~/lib/scheduler";
import { getEnvWithDefault } from "~/lib/env";

/**
 * API Route: Get Scheduler Status
 * GET /api/admin/scheduler-status
 *
 * Returns the current status of scheduled jobs
 * Requires admin access
 */

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAdmin(request);

    const status = await getSchedulerStatus();
    const neonApiKeyConfigured = !!getEnvWithDefault("NEON_API_KEY", "");
    const enableNeonBilling = getEnvWithDefault("ENABLE_NEON_BILLING", "true");

    return new Response(
      JSON.stringify({
        success: true,
        scheduler: {
          ...status,
          config: {
            neonApiKeyConfigured,
            enableNeonBilling: enableNeonBilling === "true",
          },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Scheduler] Error getting status:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get scheduler status",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
