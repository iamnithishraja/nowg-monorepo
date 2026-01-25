import { Organization, OrgProjectWallet, OrgWallet, Project } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import {
    calculateMaxCreditBack,
    calculateTotalCreditedBack,
    calculateTotalReceivedFromOrg,
    createTransaction,
    getLastTransactionId,
    validateCreditBackAmount,
} from "@nowgai/shared/utils";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";

/**
 * POST /api/admin/project-wallets/:projectId/credit-back-to-org
 * Credit back funds from project wallet to org wallet (ATOMIC)
 * Only credits back funds that were received from the org wallet
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
    const creditBackAmount = parseFloat(amount);
    if (isNaN(creditBackAmount) || creditBackAmount <= 0) {
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
              "You must be a project admin, org admin, or system admin to credit back funds to organization wallet",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      // Verify the project belongs to their organization (for project admins)
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
      // Get project wallet
      const projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      }).session(session);

      if (!projectWallet) {
        await session.abortTransaction();
        return new Response(
          JSON.stringify({
            error: "Project wallet not found",
            message: "Please create a project wallet first",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Calculate credit-back limits
      const totalReceivedFromOrg = calculateTotalReceivedFromOrg(
        projectWallet.transactions
      );
      const totalCreditedBackToOrg = calculateTotalCreditedBack(
        projectWallet.transactions
      );
      const maxAllowedCreditBack = calculateMaxCreditBack(
        projectWallet.balance,
        totalReceivedFromOrg,
        totalCreditedBackToOrg
      );

      // Validate credit-back amount
      const validation = validateCreditBackAmount(
        creditBackAmount,
        maxAllowedCreditBack,
        projectWallet.balance,
        totalReceivedFromOrg,
        totalCreditedBackToOrg
      );

      if (!validation.valid) {
        await session.abortTransaction();
        return new Response(
          JSON.stringify({
            error: "Invalid credit-back amount",
            message: validation.error,
            ...validation.details,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get org wallet
      let orgWallet = await OrgWallet.findOne({
        organizationId: project.organizationId,
        type: "org_wallet",
      }).session(session);

      if (!orgWallet) {
        await session.abortTransaction();
        return new Response(
          JSON.stringify({
            error: "Organization wallet not found",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Calculate balances
      const projectBalanceBefore = projectWallet.balance;
      const projectBalanceAfter = projectBalanceBefore - creditBackAmount;
      const orgBalanceBefore = orgWallet.balance;
      const orgBalanceAfter = orgBalanceBefore + creditBackAmount;

      // Create transactions
      const projectTransaction = createTransaction(
        "debit",
        creditBackAmount,
        projectBalanceBefore,
        projectBalanceAfter,
        description || `Credit back to organization: ${organization.name}`,
        adminUser?.id || adminUser?._id?.toString() || "system",
        {
          isCreditBack: true,
          fromAddress: projectWallet._id.toString(), // From project wallet
          toAddress: orgWallet._id.toString(), // To org wallet
        }
      );

      const orgTransaction = createTransaction(
        "credit",
        creditBackAmount,
        orgBalanceBefore,
        orgBalanceAfter,
        description || `Credit back from project: ${project.name}`,
        adminUser?.id || adminUser?._id?.toString() || "system",
        {
          isCreditBack: true,
          fromAddress: projectWallet._id.toString(), // From project wallet
          toAddress: orgWallet._id.toString(), // To org wallet
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

      // Commit the transaction
      await session.commitTransaction();

      console.log(
        `✅ Credited back $${creditBackAmount} from project ${project.name} to org ${organization.name}. Project balance: $${projectBalanceAfter}, Org balance: $${orgBalanceAfter}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully credited back $${creditBackAmount} to organization wallet`,
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
              isCreditBack: projectTransaction.isCreditBack,
              createdAt: projectTransaction.createdAt,
            },
          },
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
              isCreditBack: orgTransaction.isCreditBack,
              createdAt: orgTransaction.createdAt,
            },
          },
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
  } catch (error: any) {
    console.error("Error crediting back from project to org:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to credit back funds",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

