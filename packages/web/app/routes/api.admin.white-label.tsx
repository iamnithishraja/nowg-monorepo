import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { WhiteLabelConfig, User } from "~/models/adminModel";
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

    const configs = await WhiteLabelConfig.find({})
      .sort({ createdAt: -1 })
      .populate("userId", "email firstName lastName");

    return new Response(JSON.stringify(configs), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching white label configs:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch white label configs" }),
      {
        status: 500,
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
      const config = new WhiteLabelConfig({
        userId: data.userId,
        domain: data.domain,
        logoUrl: data.logoUrl,
        faviconUrl: data.faviconUrl,
        brandName: data.brandName,
        primaryColor: data.primaryColor,
        isActive: data.isActive || false,
        customCss: data.customCss,
      });
      await config.save();
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "PATCH") {
      const configId = pathParts[pathParts.length - 1];
      const data = await request.json();

      const config = await WhiteLabelConfig.findById(configId);
      if (!config) {
        return new Response(
          JSON.stringify({ error: "White label config not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (data.domain !== undefined) config.domain = data.domain;
      if (data.logoUrl !== undefined) config.logoUrl = data.logoUrl;
      if (data.faviconUrl !== undefined) config.faviconUrl = data.faviconUrl;
      if (data.brandName !== undefined) config.brandName = data.brandName;
      if (data.primaryColor !== undefined)
        config.primaryColor = data.primaryColor;
      if (data.isActive !== undefined) config.isActive = data.isActive;
      if (data.customCss !== undefined) config.customCss = data.customCss;
      config.updatedAt = new Date();

      await config.save();
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "DELETE") {
      const configId = pathParts[pathParts.length - 1];
      await WhiteLabelConfig.findByIdAndDelete(configId);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error in white label configs action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
