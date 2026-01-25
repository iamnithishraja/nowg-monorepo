import { UserRole } from "@nowgai/shared/types";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { getUserOrganizations, isOrganizationAdmin } from "../../lib/organizationRoles";
import Markup from "../../models/markupModel";
import Organization from "../../models/organizationModel";

// Helper to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * GET /api/admin/markup
 * Get markups for organizations
 * Only available for ORG_ADMIN: returns markups for their organization
 */
export async function getMarkup(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Please login to continue",
      });
    }

    // Allow access to super_admin (ADMIN) or org-admin
    const isSuperAdmin = user.role === UserRole.ADMIN || user.role === UserRole.TECH_SUPPORT;
    const isOrgAdmin =
      user.role === UserRole.ORG_ADMIN ||
      (user as any).hasOrgAdminAccess === true;
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Markup Settings is only available for administrators",
      });
    }

    // Build query
    let query: any = {};
    if (isSuperAdmin) {
      // Super admin can see all markups - no filter needed
      query = {};
    } else {
      // Org admin can only see markups for their organizations
      const userOrgs = await getUserOrganizations(user.id, "org_admin");
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        query.organizationId = { $in: orgIds };
      } else {
        // User has no org admin access, return empty
        return res.json({ success: true, markups: [] });
      }
    }

    // Get markups
    const markups = await Markup.find(query)
      .populate("organizationId", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Group markups by organizationId and provider
    const markupMap = new Map<string, any>();
    markups.forEach((markup: any) => {
      const orgId =
        markup.organizationId._id?.toString() ||
        markup.organizationId.toString();
      const key = `${orgId}-${markup.provider}`;
      markupMap.set(key, {
        id: markup._id.toString(),
        organizationId: orgId,
        organizationName: markup.organizationId.name || markup.organizationId,
        provider: markup.provider,
        value: markup.value,
        createdAt: markup.createdAt,
        updatedAt: markup.updatedAt,
      });
    });

    return res.json({
      success: true,
      markups: Array.from(markupMap.values()),
    });
  } catch (error: any) {
    console.error("Error fetching markups:", error);
    return res.status(500).json({
      error: "Failed to fetch markups",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/markup
 * Create or update markup for a provider
 * Only available for ORG_ADMIN: can only update markups for their organization
 */
export async function createMarkup(req: Request, res: Response) {
  try {
    const { organizationId, provider, value } = req.body;
    const user = (req as any).user;

    if (!user?.id) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Please login to continue",
      });
    }

    // Allow access to super_admin (ADMIN) or org-admin
    const isSuperAdmin = user.role === UserRole.ADMIN || user.role === UserRole.TECH_SUPPORT;
    const isOrgAdmin =
      user.role === UserRole.ORG_ADMIN ||
      (user as any).hasOrgAdminAccess === true;
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Markup Settings is only available for administrators",
      });
    }

    // Validate required fields
    if (!organizationId || !isValidObjectId(organizationId)) {
      return res
        .status(400)
        .json({ error: "Valid organization ID is required" });
    }

    if (
      !provider ||
      !["openrouter", "deployment", "managed_database"].includes(provider)
    ) {
      return res.status(400).json({
        error:
          "Provider must be one of: openrouter, deployment, managed_database",
      });
    }

    if (value === undefined || value === null) {
      return res.status(400).json({ error: "Value (percentage) is required" });
    }

    const percentageValue = parseFloat(String(value));
    if (
      isNaN(percentageValue) ||
      percentageValue < 0 ||
      percentageValue > 100
    ) {
      return res.status(400).json({
        error: "Value must be a number between 0 and 100",
      });
    }

    // Check permissions: super_admin can update any org, org_admin can only update their orgs
    if (!isSuperAdmin) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only update markups for organizations where you are an admin",
        });
      }
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Find existing markup or create new one
    let markup = await Markup.findOne({
      organizationId: organizationId,
      provider: provider,
    });

    if (markup) {
      // Update existing markup
      markup.value = percentageValue;
      markup.updatedAt = new Date();
      await markup.save();
    } else {
      // Create new markup
      markup = new Markup({
        organizationId: organizationId,
        provider: provider,
        value: percentageValue,
      });
      await markup.save();
    }

    return res.json({
      success: true,
      message: `Markup for ${provider} has been ${
        markup.isNew ? "created" : "updated"
      } successfully`,
      markup: {
        id: markup._id.toString(),
        organizationId: markup.organizationId.toString(),
        organizationName: organization.name,
        provider: markup.provider,
        value: markup.value,
        createdAt: markup.createdAt,
        updatedAt: markup.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error creating/updating markup:", error);
    return res.status(500).json({
      error: "Failed to create/update markup",
      message: error.message || "An error occurred",
    });
  }
}
