import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Project from "~/models/projectModel";
import Organization from "~/models/organizationModel";
import OrgProjectWallet from "~/models/orgProjectWalletModel";
import OrgWallet from "~/models/orgWalletModel";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess } from "~/lib/types/roles";
import { getUsersCollection } from "~/lib/adminHelpers";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import {
  createTransaction,
  getLastTransactionId,
} from "~/lib/walletHelpers";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    await requireAdmin(request);
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

    const project = await Project.findById(projectId).lean();
    if (!project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get organization
    const organization = await Organization.findById(
      project.organizationId
    ).lean();

    // Get project admin if exists
    let projectAdmin = null;
    if (project.projectAdminId) {
      const { usersCollection } = await getUsersCollection();
      const admin = await usersCollection.findOne({
        _id: new ObjectId(project.projectAdminId),
      });

      if (admin) {
        projectAdmin = {
          id: admin._id.toString(),
          email: admin.email,
          name: admin.name || "",
        };
      }
    }

    return new Response(
      JSON.stringify({
        project: {
          id: project._id.toString(),
          name: project.name,
          description: project.description || "",
          organizationId: project.organizationId.toString(),
          organization: organization
            ? {
                id: organization._id.toString(),
                name: organization.name,
              }
            : null,
          projectAdminId: project.projectAdminId || null,
          projectAdmin,
          status: project.status || "active",
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching project:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch project",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
    const method = request.method;
    const projectId = params?.projectId;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(
        JSON.stringify({ error: "Invalid project ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (method === "PUT") {
      // Update project
      const data = await request.json();
      const { name, description, status } = data;

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

      if (name !== undefined) {
        project.name = name.trim();
      }
      if (description !== undefined) {
        project.description = description?.trim() || "";
      }
      if (status !== undefined && ["active", "suspended", "archived"].includes(status)) {
        project.status = status;
      }

      await project.save();

      return new Response(
        JSON.stringify({
          id: project._id.toString(),
          name: project.name,
          description: project.description,
          organizationId: project.organizationId.toString(),
          status: project.status,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (method === "DELETE") {
      // Delete/Archive project
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

      // Check permissions - must be org admin or system admin
      if (user?.id) {
        const hasOrgAccess = await isOrganizationAdmin(
          user.id,
          project.organizationId.toString()
        );

        if (!hasOrgAccess && !hasAdminAccess(user.role)) {
          return new Response(
            JSON.stringify({
              error: "Forbidden",
              message:
                "You can only delete projects in organizations where you are an admin",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      const organization = await Organization.findById(project.organizationId);
      if (!organization) {
        return new Response(
          JSON.stringify({ error: "Organization not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Start a MongoDB session for atomic transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        let creditBackAmount = 0;
        let creditBackPerformed = false;

        // Check if project wallet exists and has balance
        const projectWallet = await OrgProjectWallet.findOne({
          projectId: projectId,
        }).session(session);

        if (projectWallet && projectWallet.balance > 0) {
          creditBackAmount = projectWallet.balance;
          
          // Get org wallet
          let orgWallet = await OrgWallet.findOne({
            organizationId: project.organizationId,
            type: "org_wallet",
          }).session(session);

          if (!orgWallet) {
            // Create org wallet if it doesn't exist
            orgWallet = new OrgWallet({
              organizationId: project.organizationId,
              type: "org_wallet",
              balance: 0,
              transactions: [],
            });
            await orgWallet.save({ session });
          }

          // Calculate balances
          const projectBalanceBefore = projectWallet.balance;
          const projectBalanceAfter = 0;
          const orgBalanceBefore = orgWallet.balance;
          const orgBalanceAfter = orgBalanceBefore + creditBackAmount;

          // Create transactions
          const projectTransaction = createTransaction(
            "debit",
            creditBackAmount,
            projectBalanceBefore,
            projectBalanceAfter,
            `Credit back to organization on project deletion: ${organization.name}`,
            user?.id || user?._id?.toString() || "system",
            {
              isCreditBack: true,
              fromAddress: projectWallet._id.toString(),
              toAddress: orgWallet._id.toString(),
            }
          );

          const orgTransaction = createTransaction(
            "credit",
            creditBackAmount,
            orgBalanceBefore,
            orgBalanceAfter,
            `Credit back from deleted project: ${project.name}`,
            user?.id || user?._id?.toString() || "system",
            {
              isCreditBack: true,
              fromAddress: projectWallet._id.toString(),
              toAddress: orgWallet._id.toString(),
            }
          );

          // Update project wallet
          projectWallet.balance = projectBalanceAfter;
          projectWallet.transactions.push(projectTransaction);
          await projectWallet.save({ session });

          // Update org wallet
          orgWallet.balance = orgBalanceAfter;
          orgWallet.transactions.push(orgTransaction);
          await orgWallet.save({ session });

          // Link transactions for audit trail
          const orgTransactionId = getLastTransactionId(orgWallet);
          if (orgTransactionId) {
            const lastProjectTxIndex = projectWallet.transactions.length - 1;
            projectWallet.transactions[
              lastProjectTxIndex
            ].relatedOrgWalletTransactionId = orgTransactionId;
            await projectWallet.save({ session });
          }

          creditBackPerformed = true;
          console.log(
            `✅ Credited back $${creditBackAmount} from deleted project ${project.name} to org ${organization.name}`
          );
        }

        // Archive the project
        project.status = "archived";
        await project.save({ session });

        // Commit the transaction
        await session.commitTransaction();

        return new Response(
          JSON.stringify({
            message: "Project archived successfully",
            creditBackPerformed,
            creditBackAmount: creditBackPerformed ? creditBackAmount : 0,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in projects action:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        message: error.message || "Unknown error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

