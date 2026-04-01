import { OrgDocumentRequirement } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";

/**
 * GET /api/admin/org-document-requirements
 * List all organization document requirements (admin only)
 */
export async function getRequirements(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can view document requirements",
      });
    }

    const requirements = await OrgDocumentRequirement.find({}).sort({ createdAt: -1 }).lean();

    const formatted = requirements.map((r: any) => ({
      id: r._id.toString(),
      name: r.name,
      description: r.description,
      isMandatory: r.isMandatory,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return res.json({ requirements: formatted });
  } catch (error: any) {
    console.error("Error fetching document requirements:", error);
    return res.status(500).json({
      error: "Failed to fetch document requirements",
      message: error.message,
    });
  }
}

/**
 * POST /api/admin/org-document-requirements
 * Create a new document requirement
 */
export async function createRequirement(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can create document requirements",
      });
    }

    const { name, description, isMandatory, isActive } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        error: "Name is required",
      });
    }

    const reqDoc = new OrgDocumentRequirement({
      name: name.trim(),
      description: description?.trim() || "",
      isMandatory: isMandatory !== false, // default true
      isActive: isActive !== false, // default true
    });

    await reqDoc.save();

    return res.status(201).json({
      success: true,
      requirement: {
        id: reqDoc._id.toString(),
        name: reqDoc.name,
        description: reqDoc.description,
        isMandatory: reqDoc.isMandatory,
        isActive: reqDoc.isActive,
        createdAt: reqDoc.createdAt,
        updatedAt: reqDoc.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error creating document requirement:", error);
    return res.status(500).json({
      error: "Failed to create document requirement",
      message: error.message,
    });
  }
}

/**
 * PUT /api/admin/org-document-requirements/:id
 * Update a document requirement
 */
export async function updateRequirement(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can update document requirements",
      });
    }

    const { id } = req.params;
    const { name, description, isMandatory, isActive } = req.body;

    const reqDoc = await OrgDocumentRequirement.findById(id);
    if (!reqDoc) {
      return res.status(404).json({ error: "Document requirement not found" });
    }

    if (name !== undefined) reqDoc.name = name.trim();
    if (description !== undefined) reqDoc.description = description.trim();
    if (isMandatory !== undefined) reqDoc.isMandatory = isMandatory;
    if (isActive !== undefined) reqDoc.isActive = isActive;
    reqDoc.updatedAt = new Date();

    await reqDoc.save();

    return res.json({
      success: true,
      requirement: {
        id: reqDoc._id.toString(),
        name: reqDoc.name,
        description: reqDoc.description,
        isMandatory: reqDoc.isMandatory,
        isActive: reqDoc.isActive,
        createdAt: reqDoc.createdAt,
        updatedAt: reqDoc.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error updating document requirement:", error);
    return res.status(500).json({
      error: "Failed to update document requirement",
      message: error.message,
    });
  }
}

/**
 * DELETE /api/admin/org-document-requirements/:id
 * Delete a document requirement
 */
export async function deleteRequirement(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can delete document requirements",
      });
    }

    const { id } = req.params;

    const reqDoc = await OrgDocumentRequirement.findByIdAndDelete(id);
    if (!reqDoc) {
      return res.status(404).json({ error: "Document requirement not found" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting document requirement:", error);
    return res.status(500).json({
      error: "Failed to delete document requirement",
      message: error.message,
    });
  }
}
