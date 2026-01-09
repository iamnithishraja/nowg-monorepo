import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import FundRequest from "~/models/fundRequestModel";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess } from "~/lib/types/roles";
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
            message: "Only organization admins can reject fund requests",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    fundRequest.status = "rejected";
    fundRequest.reviewedBy = adminUser?.id || "system";
    fundRequest.reviewComments = reviewComments?.trim() || "";
    fundRequest.reviewedAt = new Date();
    await fundRequest.save();

    return new Response(
      JSON.stringify({
        message: "Fund request rejected",
        fundRequest: {
          id: fundRequest._id.toString(),
          status: fundRequest.status,
          reviewedBy: fundRequest.reviewedBy,
          reviewComments: fundRequest.reviewComments,
          reviewedAt: fundRequest.reviewedAt,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error rejecting fund request:", error);
    console.error("Error stack:", error.stack);
    console.error("Request ID:", requestId);
    return new Response(
      JSON.stringify({
        error: "Failed to reject fund request",
        message: error.message || "An error occurred",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

