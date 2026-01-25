import { Organization, Project, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import UserProjectWallet from "~/models/userProjectWalletModel";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { userId } = params;

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    await connectToDatabase();

    const skip = (page - 1) * limit;

    // For non-system admins, filter to only wallets they can manage
    let query: any = { userId: userId };

    if (!hasAdminAccess(adminUser?.role)) {
      // Get projects where admin user is project admin or org admin
      const projectAdminProjects = await ProjectMember.find({
        userId: adminUser?.id,
        role: "project_admin",
        status: "active",
      })
        .select("projectId")
        .lean();

      // Get organizations where admin user is org admin
      const projectIds = projectAdminProjects.map((p: any) => p.projectId);

      // Get projects from orgs where user is org admin
      const orgAdminOrgs = await Organization.find({
        orgAdminId: adminUser?.id,
      })
        .select("_id")
        .lean();

      const orgIds = orgAdminOrgs.map((o: any) => o._id);

      const projects = await Project.find({
        $or: [
          { _id: { $in: projectIds } },
          { organizationId: { $in: orgIds } },
        ],
      })
        .select("_id")
        .lean();

      query.projectId = { $in: projects.map((p: any) => p._id) };
    }

    // Get all wallets for this user
    const wallets = await UserProjectWallet.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await UserProjectWallet.countDocuments(query);

    // Get project and organization details
    const projectIds = [...new Set(wallets.map((w: any) => w.projectId))];
    const projects = await Project.find({ _id: { $in: projectIds } }).lean();
    const projectMap = new Map(projects.map((p: any) => [p._id.toString(), p]));

    const orgIds = [
      ...new Set(
        projects.map((p: any) => p.organizationId?.toString()).filter(Boolean)
      ),
    ];
    const organizations = await Organization.find({
      _id: { $in: orgIds.map((id) => new ObjectId(id)) },
    }).lean();
    const orgMap = new Map(
      organizations.map((o: any) => [o._id.toString(), o])
    );

    return new Response(
      JSON.stringify({
        wallets: wallets.map((w: any) => {
          const project = projectMap.get(w.projectId.toString());
          const org = project
            ? orgMap.get(project.organizationId?.toString())
            : null;
          return {
            id: w._id.toString(),
            userId: w.userId,
            projectId: w.projectId.toString(),
            projectName: project?.name || "",
            organizationId: w.organizationId.toString(),
            organizationName: org?.name || "",
            balance: w.balance || 0, // Deprecated - always 0
            limit: w.limit ?? null,
            currentSpending: w.currentSpending || 0,
            transactionCount: w.transactions?.length || 0,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
          };
        }),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + wallets.length < total,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching project wallets for user:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch user wallets",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
