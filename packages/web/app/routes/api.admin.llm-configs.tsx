import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { LlmConfig, User } from "~/models/adminModel";
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

    const configs = await LlmConfig.find({}).sort({ createdAt: -1 });
    return new Response(JSON.stringify(configs), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching LLM configs:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch LLM configs" }),
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
      const config = new LlmConfig({
        provider: data.provider,
        apiKey: data.apiKey,
        isActive: data.isActive || false,
        modelPricing: data.modelPricing || {},
        config: data.config || {},
      });
      await config.save();
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "PATCH") {
      const configId = pathParts[pathParts.length - 1];
      const data = await request.json();

      const config = await LlmConfig.findById(configId);
      if (!config) {
        return new Response(JSON.stringify({ error: "LLM config not found" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (data.provider !== undefined) config.provider = data.provider;
      if (data.apiKey !== undefined) config.apiKey = data.apiKey;
      if (data.isActive !== undefined) config.isActive = data.isActive;
      if (data.modelPricing !== undefined)
        config.modelPricing = data.modelPricing;
      if (data.config !== undefined) config.config = data.config;
      config.updatedAt = new Date();

      await config.save();
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "DELETE") {
      const configId = pathParts[pathParts.length - 1];
      await LlmConfig.findByIdAndDelete(configId);
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
    console.error("Error in LLM configs action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
