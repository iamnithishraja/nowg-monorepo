import { OrgDocumentSubmission, Organization, OrgDocumentRequirement } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";

/**
 * GET /api/admin/organizations/:orgId/documents
 * List all document submissions for an organization
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

    const { orgId } = req.params;

    const submissions = await OrgDocumentSubmission.find({ organizationId: orgId }).sort({ createdAt: -1 }).lean();

    const formatted = submissions.map((s: any) => ({
      id: s._id.toString(),
      organizationId: s.organizationId,
      requirementId: s.requirementId,
      fileUrl: s.fileUrl,
      status: s.status,
      adminNotes: s.adminNotes,
      reviewedBy: s.reviewedBy,
      reviewedAt: s.reviewedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return res.json({ documents: formatted });
  } catch (error: any) {
    console.error("Error fetching organization documents:", error);
    return res.status(500).json({
      error: "Failed to fetch organization documents",
      message: error.message,
    });
  }
}

/**
 * PUT /api/admin/org-document-submissions/:id/review
 * Approve or reject a document submission
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

    const { id } = req.params;
    const { status, adminNotes } = req.body; // status: "approved" or "rejected"

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    const submission = await OrgDocumentSubmission.findById(id);
    if (!submission) {
      return res.status(404).json({ error: "Document submission not found" });
    }

    submission.status = status;
    submission.adminNotes = adminNotes || "";
    submission.reviewedBy = adminUser?.email || adminUser?.id || "admin";
    submission.reviewedAt = new Date();
    submission.updatedAt = new Date();

    await submission.save();

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
