import type { LoaderFunctionArgs } from "react-router";

import { Subscription, User } from "~/models/adminModel";
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

    const subscriptions = await Subscription.find({})
      .sort({ createdAt: -1 })
      .populate("userId", "email firstName lastName")
      .populate("planId", "name price billingPeriod");

    return new Response(JSON.stringify(subscriptions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching subscriptions:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch subscriptions" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
