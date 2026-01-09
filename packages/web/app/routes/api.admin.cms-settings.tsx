import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { CmsSetting, User } from "~/models/adminModel";
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

    const settings = await CmsSetting.find({}).sort({ category: 1, key: 1 });
    return new Response(JSON.stringify(settings), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching CMS settings:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch CMS settings" }),
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

    if (method === "POST") {
      const data = await request.json();

      // Upsert - update if exists, create if not
      const setting = await CmsSetting.findOneAndUpdate(
        { key: data.key },
        {
          key: data.key,
          value: data.value,
          type: data.type,
          category: data.category,
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      return new Response(JSON.stringify(setting), {
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
    console.error("Error in CMS settings action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
