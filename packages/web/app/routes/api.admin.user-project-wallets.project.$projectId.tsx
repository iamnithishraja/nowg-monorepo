import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";
import Project from "~/models/projectModel";
import UserProjectWallet from "~/models/userProjectWalletModel";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { projectId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(
        JSON.stringify({ error: "Invalid project ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    await connectToDatabase();

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions
    if (adminUser?.id) {
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );

      if (
        !hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role)
      ) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You must be a project admin or org admin to view user wallets",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    const skip = (page - 1) * limit;

    // Get all user wallets for this project
    const wallets = await UserProjectWallet.find({ projectId: projectId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await UserProjectWallet.countDocuments({
      projectId: projectId,
    });

    // Get user details
    const userIds = wallets.map((w: any) => w.userId);
    let userMap = new Map();

    if (userIds.length > 0) {
      const { usersCollection, mongoClient } = await getUsersCollection();
      const users = await usersCollection
        .find({
          _id: { $in: userIds.map((id: string) => new ObjectId(id)) },
        })
        .toArray();


      users.forEach((u: any) => {
        userMap.set(u._id.toString(), u);
      });
    }

    // Format response
    const formattedWallets = wallets.map((wallet: any) => {
      const user = userMap.get(wallet.userId);
      return {
        id: wallet._id.toString(),
        userId: wallet.userId,
        projectId: wallet.projectId.toString(),
        projectName: project.name,
        organizationId: wallet.organizationId.toString(),
        balance: wallet.balance || 0, // Deprecated - always 0
        limit: wallet.limit ?? null,
        currentSpending: wallet.currentSpending || 0,
        transactionCount: wallet.transactions?.length || 0,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
        user: user
          ? {
              id: user._id.toString(),
              email: user.email,
              name: user.name || "",
            }
          : null,
      };
    });

    return new Response(
      JSON.stringify({
        wallets: formattedWallets,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + formattedWallets.length < total,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching user project wallets:", error);
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

