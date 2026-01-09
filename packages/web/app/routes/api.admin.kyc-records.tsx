import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { KycRecord, User } from "~/models/adminModel";
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

    const records = await KycRecord.find({})
      .sort({ submittedAt: -1 })
      .populate("userId", "email firstName lastName")
      .populate("verifiedBy", "email firstName lastName");

    return new Response(JSON.stringify(records), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching KYC records:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch KYC records" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const method = request.method;
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");

    if (method === "PATCH") {
      const recordId = pathParts[pathParts.length - 1];
      const data = await request.json();

      const record = await KycRecord.findById(recordId);
      if (!record) {
        return new Response(JSON.stringify({ error: "KYC record not found" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (data.status !== undefined) {
        record.status = data.status;
        record.verifiedBy = adminUser._id;
        record.reviewedAt = new Date();
      }
      if (data.notes !== undefined) record.notes = data.notes;

      await record.save();
      return new Response(JSON.stringify(record), {
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
    console.error("Error in KYC records action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
