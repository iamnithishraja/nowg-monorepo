import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { Affiliate, User } from "~/models/adminModel";
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

    const affiliates = await Affiliate.find({})
      .sort({ createdAt: -1 })
      .populate("userId", "email firstName lastName");

    return new Response(JSON.stringify(affiliates), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching affiliates:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch affiliates" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await requireAdmin(request);
    const method = request.method;
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");

    if (method === "POST") {
      const data = await request.json();
      const affiliate = new Affiliate({
        userId: data.userId,
        code: data.code,
        commissionRate: data.commissionRate,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
      await affiliate.save();
      return new Response(JSON.stringify(affiliate), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "PATCH") {
      const affiliateId = pathParts[pathParts.length - 1];
      const data = await request.json();

      const affiliate = await Affiliate.findById(affiliateId);
      if (!affiliate) {
        return new Response(JSON.stringify({ error: "Affiliate not found" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (data.code !== undefined) affiliate.code = data.code;
      if (data.commissionRate !== undefined)
        affiliate.commissionRate = data.commissionRate;
      if (data.isActive !== undefined) affiliate.isActive = data.isActive;

      await affiliate.save();
      return new Response(JSON.stringify(affiliate), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "DELETE") {
      const affiliateId = pathParts[pathParts.length - 1];
      await Affiliate.findByIdAndDelete(affiliateId);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error in affiliates action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
