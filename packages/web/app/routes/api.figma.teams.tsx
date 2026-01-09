import type { LoaderFunctionArgs } from "react-router";
import { requireFigmaAccessToken } from "../lib/figmaIntegration.server";

/**
 * API Route: List saved Figma teams for the current user
 * GET /api/figma/teams
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { integration } = await requireFigmaAccessToken(request);

    const teamIds = Array.isArray(integration?.teamIds)
      ? integration.teamIds.map((id: any) => String(id)).filter(Boolean)
      : [];

    // De-dupe while preserving order
    const seen = new Set<string>();
    const uniqueTeamIds = teamIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const lastTeamId = integration?.lastTeamId
      ? String(integration.lastTeamId)
      : null;

    return new Response(JSON.stringify({ teamIds: uniqueTeamIds, lastTeamId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response(
      JSON.stringify({
        error: "Failed to load saved teams",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}




