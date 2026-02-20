import { Organization, OrganizationMember } from "@nowgai/shared/models";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { sendEnterpriseRequestSubmittedEmail, sendEnterpriseRequestNotificationToAdmin } from "~/lib/email";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userId = session.user.id;
    await connectToDatabase();

    const body = await request.json();
    const { 
      name, 
      description, 
      allowedDomains,
      planType = "core",
      // Enterprise-specific fields
      companySize,
      industry,
      website,
      useCase,
      contactPhone,
    } = body;

    if (!name || !name.trim()) {
      return new Response(
        JSON.stringify({ error: "Organization name is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate allowedDomains if provided
    if (allowedDomains && !Array.isArray(allowedDomains)) {
      return new Response(
        JSON.stringify({ error: "allowedDomains must be an array" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Clean and validate domains
    const cleanedDomains =
      allowedDomains?.map((domain: string) => {
        // Remove protocol and trailing slashes
        return domain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "")
          .trim();
      }) || [];

    // Check if user is already part of any organization (active or pending)
    const existingMemberships = await OrganizationMember.find({
      userId: userId,
      status: { $in: ["active", "pending"] },
    }).lean();

    if (existingMemberships.length > 0) {
      // Check if this is a pending enterprise request
      const membership = existingMemberships[0];
      const existingOrg = await Organization.findById(membership.organizationId);
      
      if (existingOrg) {
        // If it's a pending enterprise request, show appropriate message
        if (existingOrg.approvalStatus === "pending") {
          return new Response(
            JSON.stringify({
              error: "Pending request exists",
              message: `You already have a pending enterprise request for "${existingOrg.name}". Please wait for it to be reviewed.`,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        
        // If it's an active organization
        return new Response(
          JSON.stringify({
            error: "User already in another organization",
            message: `You are already a member of ${existingOrg.name}. Users cannot be members of multiple organizations. Please leave the other organization first before creating a new one.`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      // If organization doesn't exist but membership does, clean up orphaned membership
      await OrganizationMember.deleteOne({ _id: membership._id });
    }
    
    // Also check for rejected memberships and clean them up so user can try again
    const rejectedMemberships = await OrganizationMember.find({
      userId: userId,
      status: "rejected",
    }).lean();
    
    // Clean up rejected memberships so user can create new organization
    if (rejectedMemberships.length > 0) {
      await OrganizationMember.deleteMany({
        userId: userId,
        status: "rejected",
      });
    }

    // Determine if this is an enterprise request that needs approval
    const isEnterpriseRequest = planType === "enterprise";
    const approvalStatus = isEnterpriseRequest ? "pending" : null;

    // Create organization
    const organization = new Organization({
      name: name.trim(),
      description: description?.trim() || "",
      allowedDomains: cleanedDomains,
      orgAdminId: userId, // Set creator as org admin
      planType: planType,
      approvalStatus: approvalStatus,
      // Enterprise-specific fields
      ...(isEnterpriseRequest && {
        companySize,
        industry: industry?.trim() || null,
        website: website?.trim() || null,
        useCase: useCase?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
      }),
    });

    await organization.save();

    // Add creator as org_admin member
    // For enterprise requests, the membership is created but the org is pending approval
    const organizationMember = new OrganizationMember({
      userId: userId,
      organizationId: organization._id,
      role: "org_admin",
      status: isEnterpriseRequest ? "pending" : "active", // Pending for enterprise until approved
    });

    await organizationMember.save();

    // Send emails for enterprise requests
    if (isEnterpriseRequest) {
      try {
        // Send confirmation email to the user
        await sendEnterpriseRequestSubmittedEmail({
          to: session.user.email,
          userName: session.user.name || session.user.email,
          organizationName: organization.name,
        });

        // Send notification to admin
        await sendEnterpriseRequestNotificationToAdmin({
          organizationName: organization.name,
          organizationId: organization._id.toString(),
          requesterEmail: session.user.email,
          requesterName: session.user.name || "Unknown",
          companySize: companySize || "Not specified",
          industry: industry || "Not specified",
          website: website || "Not specified",
          useCase: useCase || "Not specified",
        });
      } catch (emailError) {
        console.error("Error sending enterprise request emails:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Wallet is created on-demand, so default balance is 0
    const walletBalance = 0;

    return new Response(
      JSON.stringify({
        success: true,
        organization: {
          id: organization._id.toString(),
          name: organization.name,
          description: organization.description,
          orgAdminId: organization.orgAdminId,
          allowedDomains: organization.allowedDomains,
          status: organization.status,
          planType: organization.planType,
          approvalStatus: organization.approvalStatus,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
        },
        wallet: {
          balance: walletBalance,
        },
        message: isEnterpriseRequest 
          ? "Your enterprise organization request has been submitted for review. You will receive an email once it's processed."
          : "Organization created successfully.",
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error: any) {
    console.error("Error creating organization:", error);
    if (error.name === "ValidationError") {
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: error.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new Response(
      JSON.stringify({
        error: "Failed to create organization",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
