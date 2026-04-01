import { OrgDocumentSubmission, Organization, OrgDocumentRequirement } from "@nowgai/shared/models";
import { getUsersCollection } from "../../config/db";
import { ObjectId } from "mongodb";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";
import { sendOrgDocumentRejectedEmail } from "../../lib/email";

/**
 * GET /api/admin/organizations/:orgId/documents
 * List all document submissions for an organization, with populated requirement info
 */
export async function getOrgDocuments(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can view organization documents",
      });
    }

    const orgId = req.params.orgId as string;

    const submissions = await OrgDocumentSubmission.find({ organizationId: orgId }).sort({ createdAt: -1 }).lean();

    // Collect all unique requirementIds and fetch the requirement docs
    const requirementIds = [...new Set(submissions.map((s: any) => s.requirementId).filter(Boolean))];
    const requirements = await OrgDocumentRequirement.find({ _id: { $in: requirementIds } }).lean();
    const reqMap = new Map(requirements.map((r: any) => [r._id.toString(), r]));

    // The admin-client expects { submissions: [...] } with requirementId populated
    const formatted = submissions.map((s: any) => {
      const req = reqMap.get(s.requirementId?.toString());
      return {
        id: s._id.toString(),
        organizationId: s.organizationId,
        requirementId: req
          ? {
              id: req._id.toString(),
              name: req.name,
              description: req.description || "",
              isMandatory: req.isMandatory ?? false,
            }
          : { id: s.requirementId, name: "Unknown Document", description: "", isMandatory: false },
        fileUrl: s.fileUrl,
        status: s.status,
        adminNotes: s.adminNotes,
        reviewedBy: s.reviewedBy,
        reviewedAt: s.reviewedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return res.json({ submissions: formatted });
  } catch (error: any) {
    console.error("Error fetching organization documents:", error);
    return res.status(500).json({
      error: "Failed to fetch organization documents",
      message: error.message,
    });
  }
}

/**
 * POST /api/admin/org-document-submissions/:id/review
 * Approve or reject a document submission
 * Accepts { action: 'approve' | 'request_changes', notes?: string } from the admin-client
 */
export async function reviewDocumentSubmission(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can review document submissions",
      });
    }

    const id = req.params.id as string;

    // Accept both frontend format (action/notes) and direct format (status/adminNotes)
    const rawAction = req.body.action;
    const rawStatus = req.body.status;
    const rawNotes = req.body.notes ?? req.body.adminNotes ?? "";

    // Map action → status
    let status: string;
    if (rawAction === "approve") {
      status = "approved";
    } else if (rawAction === "request_changes") {
      status = "rejected";
    } else if (rawStatus && ["approved", "rejected"].includes(rawStatus)) {
      status = rawStatus;
    } else {
      return res.status(400).json({ error: "Invalid action. Must be 'approve' or 'request_changes'." });
    }

    const submission = await OrgDocumentSubmission.findById(id);
    if (!submission) {
      return res.status(404).json({ error: "Document submission not found" });
    }

    submission.status = status;
    submission.adminNotes = rawNotes;
    submission.reviewedBy = adminUser?.email || adminUser?.id || "admin";
    submission.reviewedAt = new Date();
    submission.updatedAt = new Date();

    await submission.save();

    // If rejected, trigger the email notification
    if (status === "rejected") {
      try {
        const org = await Organization.findById(submission.organizationId);
        if (org && org.orgAdminId) {
          const usersCollection = getUsersCollection();
          const user = await usersCollection.findOne({ _id: new ObjectId(org.orgAdminId as string) });
          const reqDoc = await OrgDocumentRequirement.findById(submission.requirementId);
          if (user && reqDoc) {
            const webAppUrl = process.env.WEB_PACKAGE_URL || "http://localhost:3000";
            
            await sendOrgDocumentRejectedEmail({
              to: user.email,
              userName: user.name || "User",
              organizationName: org.name,
              documentName: reqDoc.name,
              adminNotes: rawNotes || "Please review the document and upload a valid version.",
              reuploadUrl: `${webAppUrl}/manage-org/convo`,
            });
          }
        }
      } catch (err) {
        console.error("Non-fatal error sending document rejection email", err);
      }
    }

    return res.json({
      success: true,
      document: {
        id: submission._id.toString(),
        organizationId: submission.organizationId,
        requirementId: submission.requirementId,
        fileUrl: submission.fileUrl,
        status: submission.status,
        adminNotes: submission.adminNotes,
        reviewedBy: submission.reviewedBy,
        reviewedAt: submission.reviewedAt,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error reviewing document submission:", error);
    return res.status(500).json({
      error: "Failed to review document submission",
      message: error.message,
    });
  }
}

