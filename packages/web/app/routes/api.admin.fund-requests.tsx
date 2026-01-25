import { FundRequest, Organization, OrganizationMember, OrgWallet, Project, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

/**
 * POST /api/admin/fund-requests
 * Create a fund request (project admin only)
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const adminUser = await requireAdmin(request);

    if (request.method === "POST") {
      // Create new fund request
      // Check content type and parse accordingly
      const contentType = request.headers.get("content-type") || "";
      let projectId: string;
      let amount: string;
      let description: string;

      if (contentType.includes("application/json")) {
        const body = await request.json();
        projectId = body.projectId;
        amount = body.amount?.toString();
        description = body.description || "";
      } else {
        const formData = await request.formData();
        projectId = formData.get("projectId") as string;
        amount = formData.get("amount") as string;
        description = (formData.get("description") as string) || "";
      }

      // Validate request body
      if (!projectId) {
        return new Response(
          JSON.stringify({ error: "Project ID is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!isValidObjectId(projectId)) {
        return new Response(
          JSON.stringify({ error: "Invalid project ID format" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!amount) {
        return new Response(JSON.stringify({ error: "Amount is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const requestAmount = parseFloat(String(amount));
      if (isNaN(requestAmount) || requestAmount <= 0) {
        return new Response(
          JSON.stringify({
            error: "Amount must be a positive number",
            received: amount,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (adminUser?.id) {
        const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
        const organizationId = project.organizationId;
        const hasOrgAccess = await isOrganizationAdmin(
          adminUser.id,
          organizationId.toString()
        );
        
        if (!hasProjectAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
          return new Response(
            JSON.stringify({
              error: "Forbidden",
              message: "Only project admins or organization admins can create fund requests",
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      const organizationId = project.organizationId;
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        return new Response(
          JSON.stringify({ error: "Organization not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const orgWallet = await OrgWallet.findOne({
        organizationId: organizationId,
        type: "org_wallet",
      });

      if (!orgWallet) {
        return new Response(
          JSON.stringify({
            error: "Insufficient balance",
            message: `Organization wallet does not have sufficient funds. Current balance: $0.00, Required: $${requestAmount.toFixed(
              2
            )}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (orgWallet.balance < requestAmount) {
        return new Response(
          JSON.stringify({
            error: "Insufficient balance",
            message: `Organization wallet does not have sufficient funds. Current balance: $${orgWallet.balance.toFixed(
              2
            )}, Required: $${requestAmount.toFixed(2)}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const fundRequest = new FundRequest({
        projectId: projectId,
        organizationId: organizationId,
        amount: requestAmount,
        description: description?.trim() || "",
        status: "pending",
        requestedBy: adminUser?.id || "system",
      });

      await fundRequest.save();

      return new Response(
        JSON.stringify({
          message: "Fund request created successfully",
          fundRequest: {
            id: fundRequest._id.toString(),
            projectId: fundRequest.projectId.toString(),
            organizationId: fundRequest.organizationId.toString(),
            amount: fundRequest.amount,
            description: fundRequest.description,
            status: fundRequest.status,
            requestedBy: fundRequest.requestedBy,
            createdAt: fundRequest.createdAt,
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Error in fund request action:", error);
    console.error("Error stack:", error.stack);
    console.error("Request method:", request.method);
    console.error("Request URL:", request.url);
    return new Response(
      JSON.stringify({
        error: "Failed to process fund request",
        message: error.message || "An error occurred",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * GET /api/admin/fund-requests
 * Get fund requests (filtered by user role)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const adminUser = await requireAdmin(request);

    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const organizationId = url.searchParams.get("organizationId");
    const status = url.searchParams.get("status");

    let query: any = {};

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    if (projectId && isValidObjectId(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (organizationId && isValidObjectId(organizationId)) {
      query.organizationId = new ObjectId(organizationId);
    }

    if (adminUser?.id) {
      const isFullAdmin = hasAdminAccess(adminUser.role);

      if (!isFullAdmin) {
        const isOrgAdmin =
          adminUser.role === "org_admin" ||
          (adminUser as any)?.hasOrgAdminAccess;

        if (isOrgAdmin) {
          const orgMemberships = await OrganizationMember.find({
            userId: adminUser.id,
            role: "org_admin",
            status: "active",
          }).lean();

          const orgIds = orgMemberships.map((m: any) => m.organizationId);
          if (orgIds.length > 0) {
            query.organizationId = { $in: orgIds };
          } else {
            return new Response(JSON.stringify({ fundRequests: [] }), {
              headers: { "Content-Type": "application/json" },
            });
          }
        } else {
          const isProjectAdminRole =
            adminUser.role === "project_admin" ||
            (adminUser as any)?.hasProjectAdminAccess;

          if (isProjectAdminRole) {
            const projectMemberships = await ProjectMember.find({
              userId: adminUser.id,
              role: "project_admin",
              status: "active",
            }).lean();

            const projectIds = projectMemberships.map((m: any) => m.projectId);
            if (projectIds.length > 0) {
              query.projectId = { $in: projectIds };
            } else {
              return new Response(JSON.stringify({ fundRequests: [] }), {
                headers: { "Content-Type": "application/json" },
              });
            }
          } else {
            return new Response(JSON.stringify({ fundRequests: [] }), {
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    const fundRequests = await FundRequest.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const projectIds = [
      ...new Set(fundRequests.map((r: any) => r.projectId?.toString())),
    ];
    const orgIds = [
      ...new Set(fundRequests.map((r: any) => r.organizationId?.toString())),
    ];

    const projects = await Project.find({
      _id: { $in: projectIds.map((id) => new ObjectId(id)) },
    }).lean();
    const organizations = await Organization.find({
      _id: { $in: orgIds.map((id) => new ObjectId(id)) },
    }).lean();

    const projectMap = new Map();
    projects.forEach((p: any) => {
      projectMap.set(p._id.toString(), p.name);
    });

    const orgMap = new Map();
    organizations.forEach((o: any) => {
      orgMap.set(o._id.toString(), o.name);
    });

    // Fetch user information for requestedBy users
    const userIds = [
      ...new Set(
        fundRequests
          .map((r: any) => r.requestedBy)
          .filter(Boolean)
          .filter((id: string) => isValidObjectId(id))
      ),
    ];

    const userMap = new Map();
    if (userIds.length > 0) {
      try {
        const { usersCollection } = await getUsersCollection();
        const users = await usersCollection
          .find({
            _id: { $in: userIds.map((id: string) => new ObjectId(id)) },
          })
          .toArray();

        users.forEach((u: any) => {
          userMap.set(u._id.toString(), {
            id: u._id.toString(),
            name: u.name || u.email?.split("@")[0] || "Unknown User",
            email: u.email || "",
            image: u.image || null,
          });
        });
      } catch (error) {
        console.error("Error fetching user information:", error);
        // Continue without user info if fetch fails
      }
    }

    const formattedRequests = fundRequests.map((r: any) => {
      const userInfo = r.requestedBy && isValidObjectId(r.requestedBy)
        ? userMap.get(r.requestedBy) || {
            id: r.requestedBy,
            name: `User ${r.requestedBy.slice(0, 8)}`,
            email: "",
            image: null,
          }
        : null;

      return {
        id: r._id.toString(),
        projectId: r.projectId?.toString(),
        projectName: projectMap.get(r.projectId?.toString()) || "Unknown Project",
        organizationId: r.organizationId?.toString(),
        organizationName:
          orgMap.get(r.organizationId?.toString()) || "Unknown Organization",
        amount: r.amount,
        description: r.description,
        status: r.status,
        requestedBy: r.requestedBy,
        requestedByUser: userInfo,
        reviewedBy: r.reviewedBy,
        reviewComments: r.reviewComments,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        reviewedAt: r.reviewedAt,
      };
    });

    return new Response(JSON.stringify({ fundRequests: formattedRequests }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error fetching fund requests:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch fund requests",
        message: error.message || "An error occurred",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
