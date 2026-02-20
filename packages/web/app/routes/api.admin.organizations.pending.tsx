import { Organization } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { ObjectId } from "mongodb";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);

    // Only allow system admins (ADMIN or TECH_SUPPORT) to view pending organizations
    if (!hasAdminAccess(user.role)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Only system admins can view pending organizations." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch organizations with pending approval status
    const organizations = await Organization.find({
      planType: "enterprise",
      approvalStatus: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch org admin details
    const orgAdminIds = organizations
      .map((org: any) => org.orgAdminId)
      .filter((id: string | null) => id !== null);

    let adminMap = new Map();
    if (orgAdminIds.length > 0) {
      try {
        const { usersCollection } = await getUsersCollection();
        const orgAdmins = await usersCollection
          .find({
            _id: { $in: orgAdminIds.map((id: string) => new ObjectId(id)) },
          })
          .toArray();

        orgAdmins.forEach((admin: any) => {
          adminMap.set(admin._id.toString(), admin);
        });
      } catch (error) {
        console.error("Error fetching org admin details:", error);
      }
    }

    // Format for frontend
    const formattedOrgs = organizations.map((org: any) => {
      const admin = org.orgAdminId ? adminMap.get(org.orgAdminId) : null;
      return {
        id: org._id.toString(),
        name: org.name,
        description: org.description || "",
        planType: org.planType,
        approvalStatus: org.approvalStatus,
        companySize: org.companySize || null,
        industry: org.industry || null,
        website: org.website || null,
        useCase: org.useCase || null,
        contactPhone: org.contactPhone || null,
        allowedDomains: org.allowedDomains || [],
        orgAdmin: admin
          ? {
              id: admin._id.toString(),
              email: admin.email,
              name: admin.name || "",
            }
          : null,
        createdAt: org.createdAt,
      };
    });

    return new Response(
      JSON.stringify({
        organizations: formattedOrgs,
        total: formattedOrgs.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching pending organizations:", error);
    if (error instanceof Response) {
      throw error;
    }
    return new Response(
      JSON.stringify({
        error: "Failed to fetch pending organizations",
        message: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
