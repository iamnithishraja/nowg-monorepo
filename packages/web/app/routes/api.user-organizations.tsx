import { Organization, OrganizationMember } from "@nowgai/shared/models";
import mongoose from "mongoose";
import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";

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

    const userId = session.user.id;
    await connectToDatabase();

    // Get user's organization memberships (org_admin or org_user)
    // Include both active and pending memberships (pending for enterprise requests)
    const orgMemberships = await OrganizationMember.find({
      userId: userId,
      status: { $in: ["active", "pending"] },
    })
      .sort({ joinedAt: -1 }) // Most recent first
      .lean();

    if (orgMemberships.length === 0) {
      return new Response(JSON.stringify({ organizations: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const organizationIds = orgMemberships.map((m: any) =>
      m.organizationId instanceof mongoose.Types.ObjectId
        ? m.organizationId
        : new mongoose.Types.ObjectId(m.organizationId)
    );

    // Get full organization details
    const organizations = await Organization.find({
      _id: { $in: organizationIds },
    })
      .sort({ createdAt: -1 }) // Most recently created first
      .lean();

    // Map organizations with membership info and wallet balance (default 0)
    const formattedOrganizations = organizations.map((org: any) => {
      const orgIdString = org._id.toString();
      const membership = orgMemberships.find((m: any) => {
        const memberOrgId =
          m.organizationId instanceof mongoose.Types.ObjectId
            ? m.organizationId.toString()
            : m.organizationId.toString();
        return memberOrgId === orgIdString;
      });

      return {
        id: org._id.toString(),
        name: org.name,
        description: org.description || "",
        status: org.status,
        allowedDomains: org.allowedDomains || [],
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        orgAdminId: org.orgAdminId,
        role: membership?.role || "org_user",
        walletBalance: 0, // Wallet is created on-demand, default is 0
        planType: org.planType || "core",
        approvalStatus: org.approvalStatus || null,
      };
    });

    // Also look for pending/rejected enterprise requests where user is the requester
    // (these orgs have no OrganizationMember record until approved)
    const enterpriseRequestOrgs = await Organization.find({
      orgAdminId: userId,
      planType: "enterprise",
      approvalStatus: { $in: ["pending", "rejected"] },
    })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    const enterpriseRequest = enterpriseRequestOrgs.length > 0 ? {
      id: enterpriseRequestOrgs[0]._id.toString(),
      name: enterpriseRequestOrgs[0].name,
      description: enterpriseRequestOrgs[0].description || "",
      planType: enterpriseRequestOrgs[0].planType,
      approvalStatus: enterpriseRequestOrgs[0].approvalStatus,
      approvalNotes: enterpriseRequestOrgs[0].approvalNotes || null,
      companySize: enterpriseRequestOrgs[0].companySize || null,
      industry: enterpriseRequestOrgs[0].industry || null,
      website: enterpriseRequestOrgs[0].website || null,
      useCase: enterpriseRequestOrgs[0].useCase || null,
      contactPhone: enterpriseRequestOrgs[0].contactPhone || null,
      createdAt: enterpriseRequestOrgs[0].createdAt,
    } : null;

    return new Response(
      JSON.stringify({
        organizations: formattedOrganizations,
        enterpriseRequest,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching user organizations:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch organizations",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

