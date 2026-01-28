import { Organization, OrgProjectWallet, OrgWallet, Project } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";

/**
 * POST /api/admin/project-wallets/:projectId/transfer-from-org
 * Transfer funds from organization wallet to project wallet (ATOMIC)
 * This creates a debit in org wallet and credit in project wallet
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
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

    const { amount, description } = await request.json();

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return new Response(
        JSON.stringify({
          error: "Amount must be a positive number",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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

    // Check permissions: must be project admin, org admin for this project's organization, or system admin
    if (adminUser?.id) {
      const hasAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only transfer funds to projects where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      // Verify the project belongs to their organization
      // Only check this if user is NOT an org admin for this project's organization
      if (
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role) &&
        adminUser.organizationId &&
        adminUser.organizationId !== project.organizationId.toString()
      ) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Project does not belong to your organization",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    const organizationId = project.organizationId;
    const organization = await Organization.findById(organizationId);
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
      // Get org wallet
      let orgWallet = await OrgWallet.findOne({
        organizationId: organizationId,
        type: "org_wallet",
      }).session(session);

      if (!orgWallet) {
        orgWallet = new OrgWallet({
          organizationId: organizationId,
          type: "org_wallet",
          balance: 0,
          transactions: [],
        });
        await orgWallet.save({ session });
      }

      // Check if org has sufficient balance
      if (orgWallet.balance < transferAmount) {
        await session.abortTransaction();
        return new Response(
          JSON.stringify({
            error: "Insufficient balance",
            message: `Organization wallet has insufficient balance. Current balance: ${orgWallet.balance}, Required: ${transferAmount}`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get or create project wallet
      let projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      }).session(session);

      if (!projectWallet) {
        projectWallet = new OrgProjectWallet({
          projectId: projectId,
          balance: 0,
          transactions: [],
        });
        await projectWallet.save({ session });
      }

      // Calculate balances
      const orgBalanceBefore = orgWallet.balance;
      const orgBalanceAfter = orgBalanceBefore - transferAmount;
      const projectBalanceBefore = projectWallet.balance;
      const projectBalanceAfter = projectBalanceBefore + transferAmount;

      // Create org wallet debit transaction
      const orgTransaction = {
        type: "debit",
        amount: transferAmount,
        balanceBefore: orgBalanceBefore,
        balanceAfter: orgBalanceAfter,
        description:
          description?.trim() || `Transfer to project: ${project.name}`,
        performedBy: adminUser?.id || adminUser?._id?.toString() || "system",
        fromAddress: orgWallet._id.toString(), // From org wallet
        toAddress: projectWallet._id.toString(), // To project wallet
        createdAt: new Date(),
      };

      // Create project wallet credit transaction
      const projectTransaction = {
        type: "credit",
        amount: transferAmount,
        balanceBefore: projectBalanceBefore,
        balanceAfter: projectBalanceAfter,
        description:
          description?.trim() ||
          `Transfer from organization: ${organization.name}`,
        performedBy: adminUser?.id || adminUser?._id?.toString() || "system",
        relatedOrgWalletTransactionId: null, // Will be set after org transaction is saved
        fromAddress: orgWallet._id.toString(), // From org wallet
        toAddress: projectWallet._id.toString(), // To project wallet
        createdAt: new Date(),
      };

      // Update org wallet
      orgWallet.balance = orgBalanceAfter;
      orgWallet.transactions.push(orgTransaction);
      await orgWallet.save({ session });

      // Link project transaction to org transaction
      const orgTransactionId =
        orgWallet.transactions[
          orgWallet.transactions.length - 1
        ]._id?.toString();
      if (orgTransactionId) {
        projectTransaction.relatedOrgWalletTransactionId = orgTransactionId;
      }

      // Update project wallet
      projectWallet.balance = projectBalanceAfter;
      projectWallet.transactions.push(projectTransaction);
      await projectWallet.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      console.log(
        `✅ Transferred ${transferAmount} from ${organization.name} to project ${project.name}. Org balance: ${orgBalanceAfter}, Project balance: ${projectBalanceAfter}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully transferred ${transferAmount} credits to project`,
          orgWallet: {
            id: orgWallet._id.toString(),
            organizationId: orgWallet.organizationId.toString(),
            balance: orgWallet.balance,
            transaction: {
              type: orgTransaction.type,
              amount: orgTransaction.amount,
              balanceBefore: orgTransaction.balanceBefore,
              balanceAfter: orgTransaction.balanceAfter,
              description: orgTransaction.description,
              createdAt: orgTransaction.createdAt,
            },
          },
          projectWallet: {
            id: projectWallet._id.toString(),
            projectId: projectWallet.projectId.toString(),
            balance: projectWallet.balance,
            transaction: {
              type: projectTransaction.type,
              amount: projectTransaction.amount,
              balanceBefore: projectTransaction.balanceBefore,
              balanceAfter: projectTransaction.balanceAfter,
              description: projectTransaction.description,
              createdAt: projectTransaction.createdAt,
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    console.error("Error transferring funds to project:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to transfer funds",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

