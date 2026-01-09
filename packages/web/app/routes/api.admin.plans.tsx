import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Plan, User } from "~/models/adminModel";
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

    const plans = await Plan.find({}).sort({ price: 1 });
    return new Response(JSON.stringify(plans), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching plans:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch plans" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
      const plan = new Plan({
        name: data.name,
        description: data.description,
        price: data.price,
        billingPeriod: data.billingPeriod,
        tokensIncluded: data.tokensIncluded || 0,
        storageLimit: data.storageLimit || 1024,
        projectsLimit: data.projectsLimit || 10,
        features: data.features || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
      await plan.save();
      return new Response(JSON.stringify(plan), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "PATCH") {
      const planId = pathParts[pathParts.length - 1];
      const data = await request.json();

      const plan = await Plan.findById(planId);
      if (!plan) {
        return new Response(JSON.stringify({ error: "Plan not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (data.name !== undefined) plan.name = data.name;
      if (data.description !== undefined) plan.description = data.description;
      if (data.price !== undefined) plan.price = data.price;
      if (data.billingPeriod !== undefined)
        plan.billingPeriod = data.billingPeriod;
      if (data.tokensIncluded !== undefined)
        plan.tokensIncluded = data.tokensIncluded;
      if (data.storageLimit !== undefined)
        plan.storageLimit = data.storageLimit;
      if (data.projectsLimit !== undefined)
        plan.projectsLimit = data.projectsLimit;
      if (data.features !== undefined) plan.features = data.features;
      if (data.isActive !== undefined) plan.isActive = data.isActive;

      await plan.save();
      return new Response(JSON.stringify(plan), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "DELETE") {
      const planId = pathParts[pathParts.length - 1];
      await Plan.findByIdAndDelete(planId);
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
    console.error("Error in plans action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
