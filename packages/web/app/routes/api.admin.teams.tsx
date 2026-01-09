import type { LoaderFunctionArgs } from "react-router";

import { Team, User } from "~/models/adminModel";
import { auth } from "~/lib/auth";

async function requireAdmin(request: Request) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const user = await User.findOne({ email: session.user.email });
  if (!user || user.role !== "admin") {
    throw new Response("Forbidden - Admin access required", { status: 403 });
  }

  return user;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requireAdmin(request);

    const teams = await Team.find({})
      .sort({ createdAt: -1 })
      .populate("ownerId", "email firstName lastName");

    return new Response(JSON.stringify(teams), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching teams:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch teams" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
