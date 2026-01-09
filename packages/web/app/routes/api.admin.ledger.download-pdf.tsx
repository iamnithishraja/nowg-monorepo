import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requireAdmin(request);

    // TODO: Implement PDF generation
    // This is a stub that returns an error
    return new Response(
      JSON.stringify({ error: "PDF download not yet implemented" }),
      {
        status: 501,
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

