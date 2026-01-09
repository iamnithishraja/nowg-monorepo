import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");

    // TODO: Implement actual projects query for filter
    // This is a stub that returns the expected structure
    return new Response(
      JSON.stringify({
        projects: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

