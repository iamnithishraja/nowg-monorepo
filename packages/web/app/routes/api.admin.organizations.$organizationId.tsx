import { ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess, ProjectRole } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import Organization from "~/models/organizationModel";
import Project from "~/models/projectModel";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
    const { organizationId } = params;

    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      return new Response(
        JSON.stringify({ error: "Invalid organization ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get organization
    const organization = await Organization.findById(organizationId).lean();
    if (!organization) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions
    // Allow access if user is:
    // 1. Organization admin for this organization
    // 2. System admin (hasAdminAccess)
    // 3. Project admin for any project in this organization
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      const hasSystemAccess = hasAdminAccess(user.role);
      
      // Check if user is project admin for any project in this organization
      let hasProjectAdminAccess = false;
      if (!hasOrgAccess && !hasSystemAccess) {
        // Check 1: ProjectMember with project_admin role
        const projectAdminMembership = await ProjectMember.findOne({
          userId: user.id,
          organizationId: new mongoose.Types.ObjectId(organizationId),
          role: ProjectRole.PROJECT_ADMIN,
          status: "active",
        }).lean();
        
        if (projectAdminMembership) {
          hasProjectAdminAccess = true;
        } else {
          // Check 2: Project.projectAdminId
          const projectAsAdmin = await Project.findOne({
            organizationId: new mongoose.Types.ObjectId(organizationId),
            projectAdminId: user.id,
          }).lean();
          
          hasProjectAdminAccess = !!projectAsAdmin;
        }
      }
      
      if (!hasOrgAccess && !hasSystemAccess && !hasProjectAdminAccess) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "You don't have access to this organization",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        organization: {
          id: (organization as any)._id.toString(),
          name: (organization as any).name,
          description: (organization as any).description || "",
          logoUrl: (organization as any).logoUrl || null,
          status: (organization as any).status || "active",
          allowedDomains: (organization as any).allowedDomains || [],
          paymentProvider: (organization as any).paymentProvider || null,
          createdAt: (organization as any).createdAt,
          updatedAt: (organization as any).updatedAt,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching organization:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch organization",
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
    const { organizationId } = params;

    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      return new Response(
        JSON.stringify({ error: "Invalid organization ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const method = request.method;

    if (method === "PUT" || method === "PATCH") {
      const data = await request.json();
      const { name, description } = data;

      // Get organization
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

      // Check permissions
      if (user?.id) {
        const hasAccess = await isOrganizationAdmin(user.id, organizationId);
        if (!hasAccess && !hasAdminAccess(user.role)) {
          return new Response(
            JSON.stringify({
              error: "Forbidden",
              message:
                "You can only update organizations where you are an admin",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      // Update fields
      if (name !== undefined && name.trim()) {
        organization.name = name.trim();
      }
      if (description !== undefined) {
        organization.description = description?.trim() || "";
      }

      organization.updatedAt = new Date();
      await organization.save();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Organization updated successfully",
          organization: {
            id: organization._id.toString(),
            name: organization.name,
            description: organization.description || "",
            logoUrl: organization.logoUrl || null,
            status: organization.status || "active",
            allowedDomains: organization.allowedDomains || [],
            paymentProvider: organization.paymentProvider || null,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error updating organization:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update organization",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

