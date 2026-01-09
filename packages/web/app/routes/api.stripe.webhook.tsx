// DISABLED: This webhook route is no longer used.
// Payment verification is now handled directly via /api/stripe/verify endpoint
// to avoid webhook dependencies and implement the new pricing model.

import type { ActionFunctionArgs } from "react-router";

export async function action({ request }: ActionFunctionArgs) {
  // Return 410 Gone to indicate this endpoint is no longer available
  return new Response(
    JSON.stringify({
      error:
        "This webhook endpoint is no longer used. Payment verification is handled via /api/stripe/verify",
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    }
  );
}
