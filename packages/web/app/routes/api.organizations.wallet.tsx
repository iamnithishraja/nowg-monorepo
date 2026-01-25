import { OrganizationMember, OrgWallet } from "@nowgai/shared/models";
import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import Organization from "~/models/organizationModel";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get organizationId from URL params
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await connectToDatabase();

    // Check if user is org admin
    const membership = await OrganizationMember.findOne({
      organizationId,
      userId: session.user.id,
      role: "org_admin",
      status: "active",
    });

    if (!membership) {
      return new Response(
        JSON.stringify({
          error: "You must be an organization admin to access wallet",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get or create wallet
    let wallet = await OrgWallet.findOne({
      organizationId: organizationId,
      type: "org_wallet",
    });

    if (!wallet) {
      wallet = new OrgWallet({
        organizationId: organizationId,
        type: "org_wallet",
        balance: 0,
        transactions: [],
      });
      await wallet.save();
    }

    return new Response(
      JSON.stringify({
        success: true,
        wallet: {
          id: wallet._id.toString(),
          organizationId: wallet.organizationId.toString(),
          balance: wallet.balance,
          transactionCount: wallet.transactions?.length || 0,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching organization wallet:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch organization wallet",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

