import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { AiAgent, User } from "~/models/adminModel";
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

    const agents = await AiAgent.find({}).sort({ createdAt: -1 });
    return new Response(JSON.stringify(agents), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching AI agents:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch AI agents" }),
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
      const agent = new AiAgent({
        name: data.name,
        description: data.description,
        model: data.model,
        systemPrompt: data.systemPrompt,
        temperature: data.temperature || 0.7,
        maxTokens: data.maxTokens || 2000,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
      await agent.save();
      return new Response(JSON.stringify(agent), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "PATCH") {
      const agentId = pathParts[pathParts.length - 1];
      const data = await request.json();

      const agent = await AiAgent.findById(agentId);
      if (!agent) {
        return new Response(JSON.stringify({ error: "AI agent not found" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (data.name !== undefined) agent.name = data.name;
      if (data.description !== undefined) agent.description = data.description;
      if (data.model !== undefined) agent.model = data.model;
      if (data.systemPrompt !== undefined)
        agent.systemPrompt = data.systemPrompt;
      if (data.temperature !== undefined) agent.temperature = data.temperature;
      if (data.maxTokens !== undefined) agent.maxTokens = data.maxTokens;
      if (data.isActive !== undefined) agent.isActive = data.isActive;
      agent.updatedAt = new Date();

      await agent.save();
      return new Response(JSON.stringify(agent), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "DELETE") {
      const agentId = pathParts[pathParts.length - 1];
      await AiAgent.findByIdAndDelete(agentId);
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
    console.error("Error in AI agents action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
