import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import FundRequest from "~/models/fundRequestModel";
import Project from "~/models/projectModel";
import OrgWallet from "~/models/orgWalletModel";
import OrgProjectWallet from "~/models/orgProjectWalletModel";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess } from "~/lib/types/roles";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const adminUser = await requireAdmin(request);
    const { requestId } = params;

    if (!requestId || !isValidObjectId(requestId)) {
      return new Response(
        JSON.stringify({ error: "Invalid request ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check content type and parse accordingly
    const contentType = request.headers.get("content-type") || "";
    let reviewComments: string;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      reviewComments = body.reviewComments || "";
    } else {
      const formData = await request.formData();
      reviewComments = formData.get("reviewComments") as string || "";
    }

    const fundRequest = await FundRequest.findById(requestId);
    if (!fundRequest) {
      return new Response(
        JSON.stringify({ error: "Fund request not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (fundRequest.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: "Request already processed",
          message: `This request has already been ${fundRequest.status}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        fundRequest.organizationId.toString()
      );
      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Only organization admins can approve fund requests",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const orgWallet = await OrgWallet.findOne({
      organizationId: fundRequest.organizationId,
      type: "org_wallet",
    });

    if (!orgWallet) {
      return new Response(
        JSON.stringify({
          error: "Insufficient balance",
          message: `Organization wallet does not have sufficient funds. Current balance: $0.00, Required: $${fundRequest.amount.toFixed(2)}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (orgWallet.balance < fundRequest.amount) {
      return new Response(
        JSON.stringify({
          error: "Insufficient balance",
          message: `Organization wallet does not have sufficient funds. Current balance: $${orgWallet.balance.toFixed(2)}, Required: $${fundRequest.amount.toFixed(2)}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      fundRequest.status = "approved";
      fundRequest.reviewedBy = adminUser?.id || "system";
      fundRequest.reviewComments = reviewComments?.trim() || "";
      fundRequest.reviewedAt = new Date();
      await fundRequest.save({ session });

      const project = await Project.findById(fundRequest.projectId).session(session);
      if (!project) {
        throw new Error("Project not found");
      }

      const transferAmount = fundRequest.amount;
      const orgBalanceBefore = orgWallet.balance;
      const orgBalanceAfter = orgBalanceBefore - transferAmount;

      let projectWallet = await OrgProjectWallet.findOne({
        projectId: fundRequest.projectId,
      }).session(session);

      if (!projectWallet) {
        projectWallet = new OrgProjectWallet({
          projectId: fundRequest.projectId,
          balance: 0,
          transactions: [],
        });
        await projectWallet.save({ session });
      }

      const projectBalanceBefore = projectWallet.balance;
      const projectBalanceAfter = projectBalanceBefore + transferAmount;

      const orgTransaction = {
        type: "debit",
        amount: transferAmount,
        balanceBefore: orgBalanceBefore,
        balanceAfter: orgBalanceAfter,
        description: fundRequest.description || `Transfer to project: ${project.name} (Approved fund request)`,
        performedBy: adminUser?.id || "system",
        fromAddress: orgWallet._id.toString(),
        toAddress: projectWallet._id.toString(),
        createdAt: new Date(),
      };

      const projectTransaction = {
        type: "credit",
        amount: transferAmount,
        balanceBefore: projectBalanceBefore,
        balanceAfter: projectBalanceAfter,
        description: fundRequest.description || `Transfer from organization: ${project.organizationId} (Approved fund request)`,
        performedBy: adminUser?.id || "system",
        relatedOrgWalletTransactionId: null,
        fromAddress: orgWallet._id.toString(),
        toAddress: projectWallet._id.toString(),
        createdAt: new Date(),
      };

      orgWallet.balance = orgBalanceAfter;
      orgWallet.transactions.push(orgTransaction);
      await orgWallet.save({ session });

      const orgTransactionId =
        orgWallet.transactions[orgWallet.transactions.length - 1]._id?.toString();
      if (orgTransactionId) {
        projectTransaction.relatedOrgWalletTransactionId = orgTransactionId;
      }

      projectWallet.balance = projectBalanceAfter;
      projectWallet.transactions.push(projectTransaction);
      await projectWallet.save({ session });

      await session.commitTransaction();
      await session.endSession();

      return new Response(
        JSON.stringify({
          message: "Fund request approved and funds transferred successfully",
          fundRequest: {
            id: fundRequest._id.toString(),
            status: fundRequest.status,
            reviewedBy: fundRequest.reviewedBy,
            reviewedAt: fundRequest.reviewedAt,
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      await session.abortTransaction();
      await session.endSession();
      throw error;
    }
  } catch (error: any) {
    console.error("Error approving fund request:", error);
    console.error("Error stack:", error.stack);
    console.error("Request ID:", requestId);
    return new Response(
      JSON.stringify({
        error: "Failed to approve fund request",
        message: error.message || "An error occurred",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

