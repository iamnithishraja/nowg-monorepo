import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requireAdmin(request);

    // TODO: Implement actual summary query
    // This is a stub that returns the expected structure
    return new Response(
      JSON.stringify({
        organizationWallets: {
          count: 0,
          totalBalance: 0,
          totalTransactions: 0,
        },
        projectWallets: {
          count: 0,
          totalBalance: 0,
          totalTransactions: 0,
        },
        userProjectWallets: {
          count: 0,
          totalBalance: 0,
          totalTransactions: 0,
          uniqueUsers: 0,
          uniqueProjects: 0,
        },
        overall: {
          totalWallets: 0,
          totalBalance: 0,
          totalTransactions: 0,
        },
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

