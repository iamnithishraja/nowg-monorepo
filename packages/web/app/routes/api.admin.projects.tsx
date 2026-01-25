import { OrganizationMember, OrgWallet, ProjectMember } from "@nowgai/shared/models";
import {
    OrganizationRole,
    ProjectRole
} from "@nowgai/shared/types";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { getUserOrganizations } from "~/lib/organizationRoles";
import { getUserProjects } from "~/lib/projectRoles";
import Conversation from "~/models/conversationModel";
import Organization from "~/models/organizationModel";
import OrgProjectWallet from "~/models/orgProjectWalletModel";
import Project from "~/models/projectModel";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";
    const organizationId = url.searchParams.get("organizationId") || "";

    // Build search query
    let query: any = {};

    // Check if user has project admin role in any project
    const userProjects = user?.id
      ? await getUserProjects(user.id, ProjectRole.PROJECT_ADMIN)
      : [];

    if (userProjects.length > 0) {
      // If user is PROJECT_ADMIN, only show projects where they are admin
      const projectIds = userProjects.map((p) => new ObjectId(p.projectId));
      query._id = { $in: projectIds };
    }
    // If user has org admin role, only show projects for their organizations
    else if (user?.id) {
      const userOrgs = await getUserOrganizations(
        user.id,
        OrganizationRole.ORG_ADMIN
      );
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        query.organizationId = {
          $in: orgIds.map((id: string) => new ObjectId(id)),
        };
      }
    } else if (organizationId && ObjectId.isValid(organizationId)) {
      // If specific organizationId is provided and user has access
      query.organizationId = new ObjectId(organizationId);
    }

    // Add search filters if provided
    if (search) {
      const searchQuery = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };
      // Combine with existing query
      if (query._id || query.organizationId) {
        query = { $and: [query, searchQuery] };
      } else {
        query = { ...query, ...searchQuery };
      }
    }

    // Get total count
    const total = await Project.countDocuments(query);

    // Fetch paginated projects
    const skip = (page - 1) * limit;
    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch project admin details and organization details
    const projectAdminIds = projects
      .map((proj: any) => proj.projectAdminId)
      .filter((id: string | null) => id !== null && id !== undefined);
    const orgIds = projects
      .map((proj: any) => proj.organizationId)
      .filter((id: any) => id !== null && id !== undefined);

    let adminMap = new Map();
    if (projectAdminIds.length > 0) {
      try {
        const { usersCollection } = await getUsersCollection();
        const projectAdmins = await usersCollection
          .find({
            _id: { $in: projectAdminIds.map((id: string) => new ObjectId(id)) },
          })
          .toArray();

        projectAdmins.forEach((admin: any) => {
          adminMap.set(admin._id.toString(), admin);
        });
      } catch (error) {
        console.error("Error fetching project admin details:", error);
        // Continue without admin details - projects will still be returned
      }
    }

    let orgMap = new Map();
    if (orgIds.length > 0) {
      try {
        const uniqueOrgIds = [
          ...new Set(orgIds.map((id: any) => id.toString())),
        ];
        const organizations = await Organization.find({
          _id: { $in: uniqueOrgIds.map((id: string) => new ObjectId(id)) },
        }).lean();

        organizations.forEach((org: any) => {
          orgMap.set(org._id.toString(), org);
        });
      } catch (error) {
        console.error("Error fetching organization details:", error);
        // Continue without organization details - projects will still be returned
      }
    }

    // Fetch conversations linked to projects
    const projectIds = projects.map((proj: any) => proj._id);
    const conversations = projectIds.length > 0
      ? await Conversation.find({
          adminProjectId: { $in: projectIds },
        }).select('_id adminProjectId').lean()
      : [];

    const conversationByProjectId = Object.fromEntries(
      conversations.map((conv: any) => [
        conv.adminProjectId.toString(),
        conv._id.toString(),
      ])
    );

    // Format for frontend
    const formattedProjects = projects.map((proj: any) => {
      const admin = proj.projectAdminId
        ? adminMap.get(proj.projectAdminId)
        : null;
      const org = proj.organizationId
        ? orgMap.get(proj.organizationId.toString())
        : null;
      return {
        id: proj._id.toString(),
        name: proj.name,
        description: proj.description || "",
        imageUrl: proj.imageUrl || null,
        organizationId: proj.organizationId?.toString() || "",
        organization: org
          ? {
              id: org._id.toString(),
              name: org.name,
            }
          : null,
        projectAdminId: proj.projectAdminId || null,
        projectAdmin: admin
          ? {
              id: admin._id.toString(),
              email: admin.email,
              name: admin.name || "",
            }
          : null,
        status: proj.status || "active",
        invitationStatus: proj.invitationStatus || null,
        invitedAt: proj.invitedAt || null,
        createdAt: proj.createdAt,
        updatedAt: proj.updatedAt,
        conversationId: conversationByProjectId[proj._id.toString()] || null,
      };
    });

    return new Response(
      JSON.stringify({
        projects: formattedProjects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + projects.length < total,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    if (error instanceof Response) {
      throw error;
    }
    return new Response(
      JSON.stringify({
        error: "Failed to fetch projects",
        message: error.message || "Unknown error",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
    const method = request.method;

    if (method === "POST") {
      // Create new project
      const data = await request.json();
      const { name, description, organizationId, projectAdminId, initialFunding, imageData, imageName, imageType } = data;

      if (!name || !name.trim()) {
        return new Response(
          JSON.stringify({ 
            error: "Project name is required",
            message: "Please provide a project name"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!organizationId || !ObjectId.isValid(organizationId)) {
        return new Response(
          JSON.stringify({ 
            error: "Valid organization ID is required",
            message: "Please select a valid organization"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!projectAdminId || !ObjectId.isValid(projectAdminId)) {
        return new Response(
          JSON.stringify({ 
            error: "Project admin is required",
            message: "Please assign a project admin before creating the project"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if organization exists
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        return new Response(
          JSON.stringify({ 
            error: "Organization not found",
            message: "The specified organization does not exist"
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Verify that project admin is a member of the organization
      const orgMember = await OrganizationMember.findOne({
        userId: projectAdminId,
        organizationId: organizationId,
        status: "active",
      });

      if (!orgMember) {
        return new Response(
          JSON.stringify({
            error: "Invalid project admin",
            message: "The selected user must be an active member of the organization before they can be assigned as project admin",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if project name already exists for this organization
      const existingProject = await Project.findOne({
        organizationId: new ObjectId(organizationId),
        name: name.trim(),
      });

      if (existingProject) {
        return new Response(
          JSON.stringify({
            error: "Project name already exists",
            message:
              "A project with this name already exists in this organization",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Validate initialFunding if provided
      let fundingAmount = 0;
      if (initialFunding !== undefined && initialFunding !== null) {
        fundingAmount = parseFloat(String(initialFunding));
        if (isNaN(fundingAmount) || fundingAmount < 0) {
          return new Response(
            JSON.stringify({
              error: "Invalid funding amount",
              message: "Initial funding must be a non-negative number",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      // Start MongoDB session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Create project
        const project = new Project({
          name: name.trim(),
          description: description?.trim() || "",
          organizationId: new ObjectId(organizationId),
          projectAdminId: projectAdminId,
          status: "active",
          invitationStatus: "accepted",
          invitedAt: new Date(),
          invitedBy: user?.id || "system",
        });

        await project.save({ session });

        // Create project wallet
        const projectWallet = new OrgProjectWallet({
          projectId: project._id,
          balance: 0,
          transactions: [],
        });
        await projectWallet.save({ session });

        // Assign project admin
        try {
          const projectMember = new ProjectMember({
            projectId: project._id,
            userId: projectAdminId,
            organizationId: new ObjectId(organizationId),
            role: ProjectRole.PROJECT_ADMIN,
            status: "active",
            assignedBy: user?.id || "system",
            assignedAt: new Date(),
          });
          await projectMember.save({ session });
        } catch (memberError: any) {
          // Handle duplicate key error
          if (memberError.code === 11000) {
            const existingMember = await ProjectMember.findOne({
              projectId: project._id,
              userId: projectAdminId,
            }).session(session);
            if (existingMember) {
              existingMember.role = ProjectRole.PROJECT_ADMIN;
              existingMember.status = "active";
              existingMember.assignedBy = user?.id || "system";
              existingMember.assignedAt = new Date();
              existingMember.updatedAt = new Date();
              await existingMember.save({ session });
            } else {
              throw memberError;
            }
          } else {
            throw memberError;
          }
        }

        // Handle initial funding transfer if provided
        if (fundingAmount > 0) {
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
          if (orgWallet.balance < fundingAmount) {
            await session.abortTransaction();
            await session.endSession();
            return new Response(
              JSON.stringify({
                error: "Insufficient balance",
                message: `Organization wallet has insufficient balance. Current balance: ${orgWallet.balance}, Required: ${fundingAmount}`,
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Debit from org wallet
          const orgBalanceBefore = orgWallet.balance;
          const orgBalanceAfter = orgBalanceBefore - fundingAmount;
          const orgTransaction = {
            type: "debit",
            amount: fundingAmount,
            balanceBefore: orgBalanceBefore,
            balanceAfter: orgBalanceAfter,
            description: `Transfer to project: ${project.name}`,
            performedBy: user?.id || "system",
            fromAddress: orgWallet._id.toString(),
            toAddress: projectWallet._id.toString(),
            createdAt: new Date(),
          };
          orgWallet.balance = orgBalanceAfter;
          orgWallet.transactions.push(orgTransaction);
          await orgWallet.save({ session });

          // Credit to project wallet
          const projectBalanceBefore = projectWallet.balance;
          const projectBalanceAfter = projectBalanceBefore + fundingAmount;
          const orgTransactionId =
            orgWallet.transactions[orgWallet.transactions.length - 1]._id?.toString();
          const projectTransaction = {
            type: "credit",
            amount: fundingAmount,
            balanceBefore: projectBalanceBefore,
            balanceAfter: projectBalanceAfter,
            description: `Initial funding from organization`,
            performedBy: user?.id || "system",
            relatedOrgWalletTransactionId: orgTransactionId || null,
            fromAddress: orgWallet._id.toString(),
            toAddress: projectWallet._id.toString(),
            createdAt: new Date(),
          };
          projectWallet.balance = projectBalanceAfter;
          projectWallet.transactions.push(projectTransaction);
          await projectWallet.save({ session });
        }

        // Commit transaction
        await session.commitTransaction();
        await session.endSession();

        // Handle image upload if provided (after transaction commit)
        let projectImageUrl: string | null = null;
        if (imageData) {
          try {
            const uploadedUrl = await uploadProjectImage(
              project._id.toString(),
              imageData,
              imageName,
              imageType
            );
            if (uploadedUrl) {
              projectImageUrl = uploadedUrl;
              await Project.findByIdAndUpdate(project._id, {
                imageUrl: uploadedUrl,
                updatedAt: new Date(),
              });
            }
          } catch (uploadError: any) {
            console.error("Failed to upload project image:", uploadError.message);
            // Don't fail project creation if image upload fails
          }
        }

        // Automatically create a conversation for the project
        try {
          // Check if conversation already exists (shouldn't happen, but safety check)
          const existingConversation = await Conversation.findOne({
            adminProjectId: project._id,
          });

          if (!existingConversation) {
            // Use project admin as the conversation owner
            let conversationUserId = projectAdminId;

            // Fallback to user creating the project or org admin
            if (!conversationUserId && user?.id) {
              conversationUserId = user.id;
            }
            if (!conversationUserId && organization.orgAdminId) {
              conversationUserId = organization.orgAdminId.toString();
            }

            // If still no user ID, we can't create a conversation
            if (conversationUserId) {
              const conversation = new Conversation({
                userId: conversationUserId,
                title: project.name, // Use project name as conversation title
                model: "anthropic/claude-4.5-sonnet", // Default to Claude 4.5 Sonnet
                adminProjectId: project._id,
                projectType: "personal", // Set as personal since it's linked to admin project
                filesMap: {},
                // Initialize Supabase structure (disabled by default, can be enabled later)
                supabase: {
                  enabled: false,
                },
              });

              await conversation.save();
              console.log(
                `✅ Automatically created conversation for project: ${project.name}`
              );
            } else {
              console.warn(
                `⚠️ Could not create conversation for project ${project.name}: No user ID available`
              );
            }
          }
        } catch (conversationError) {
          console.error(
            "❌ Failed to create conversation for project:",
            conversationError
          );
          // Don't fail project creation if conversation creation fails
        }

        return new Response(
          JSON.stringify({
            id: project._id.toString(),
            name: project.name,
            description: project.description,
            imageUrl: projectImageUrl,
            organizationId: project.organizationId.toString(),
            projectAdminId: project.projectAdminId,
            status: project.status,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        // Abort transaction on error
        try {
          await session.abortTransaction();
          await session.endSession();
        } catch (abortError) {
          console.error("Error aborting transaction:", abortError);
        }
        
        // Return specific error messages
        if (error.message && error.message.includes("duplicate")) {
          return new Response(
            JSON.stringify({
              error: "Duplicate entry",
              message: "A project member with this role already exists",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        
        throw error;
      }
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    console.error("Error in projects action:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        message: error.message || "Unknown error",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Helper function to upload project image to R2
 */
async function uploadProjectImage(
  projectId: string,
  imageData: string,
  imageName?: string,
  imageType?: string
): Promise<string | null> {
  try {
    // Get R2 configuration
    const r2Endpoint = getEnvWithDefault("R2_ENDPOINT", "");
    const r2AccessKey = getEnvWithDefault("R2_ACCESS_KEY", "");
    const r2SecretKey = getEnvWithDefault("R2_SECRET_KEY", "");
    const r2BucketName = getEnvWithDefault("R2_BUCKET_NAME", "");
    const r2PublicBaseUrl = getEnvWithDefault("R2_PUBLIC_BASE_URL", "");

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey || !r2BucketName) {
      console.error("R2 configuration is incomplete");
      return null;
    }

    // Process image data (remove data URL prefix if present)
    let base64Data = imageData;
    if (imageData.includes(",")) {
      base64Data = imageData.split(",")[1];
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString("hex");
    const extension = getExtensionFromMimeType(imageType || "image/png");
    const sanitizedName = (imageName || "image").replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 50);
    const objectKey = `projects/${projectId}/${timestamp}-${randomId}-${sanitizedName}${extension}`;

    // Upload to R2 using S3-compatible API
    const uploadResult = await uploadToR2({
      endpoint: r2Endpoint,
      accessKey: r2AccessKey,
      secretKey: r2SecretKey,
      bucketName: r2BucketName,
      objectKey,
      imageBuffer,
      contentType: imageType || "image/png",
    });

    if (!uploadResult.success) {
      console.error("Failed to upload to R2:", uploadResult.error);
      return null;
    }

    // Construct public URL
    const publicUrl = r2PublicBaseUrl
      ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`
      : `${r2Endpoint}/${r2BucketName}/${objectKey}`;

    return publicUrl;
  } catch (error: any) {
    console.error("Error uploading project image:", error.message);
    return null;
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };
  return mimeToExt[mimeType] || ".png";
}

/**
 * Upload image to R2 using S3-compatible API
 */
async function uploadToR2({
  endpoint,
  accessKey,
  secretKey,
  bucketName,
  objectKey,
  imageBuffer,
  contentType,
}: {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  objectKey: string;
  imageBuffer: Buffer;
  contentType: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse endpoint to get host
    const endpointUrl = new URL(endpoint);
    const host = endpointUrl.host;
    const region = "auto"; // R2 uses 'auto' for region
    const service = "s3";

    // Prepare request details
    const method = "PUT";
    const url = `${endpoint}/${bucketName}/${objectKey}`;
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    // Create payload hash
    const payloadHash = crypto
      .createHash("sha256")
      .update(imageBuffer)
      .digest("hex");

    // Create canonical headers
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": imageBuffer.length.toString(),
      "Host": host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };

    // Create signed headers string
    const signedHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .join(";");

    // Rebuild canonical headers properly
    const sortedHeaderKeys = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort();

    const canonicalHeadersStr = sortedHeaderKeys
      .map((k) => {
        const originalKey = Object.keys(headers).find(
          (hk) => hk.toLowerCase() === k
        );
        return `${k}:${headers[originalKey!].trim()}`;
      })
      .join("\n") + "\n";

    const canonicalUri = `/${bucketName}/${objectKey}`;
    const canonicalQueryString = "";

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeadersStr,
      signedHeaders,
      payloadHash,
    ].join("\n");

    // Create string to sign
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = crypto
      .createHash("sha256")
      .update(canonicalRequest)
      .digest("hex");

    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join("\n");

    // Calculate signature
    const getSignatureKey = (
      key: string,
      dateStamp: string,
      regionName: string,
      serviceName: string
    ): Buffer => {
      const kDate = crypto
        .createHmac("sha256", `AWS4${key}`)
        .update(dateStamp)
        .digest();
      const kRegion = crypto
        .createHmac("sha256", kDate)
        .update(regionName)
        .digest();
      const kService = crypto
        .createHmac("sha256", kRegion)
        .update(serviceName)
        .digest();
      const kSigning = crypto
        .createHmac("sha256", kService)
        .update("aws4_request")
        .digest();
      return kSigning;
    };

    const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    // Create authorization header
    const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Make the request
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        Authorization: authorization,
      },
      body: new Uint8Array(imageBuffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("R2 upload error:", response.status, errorText);
      return {
        success: false,
        error: `R2 upload failed: ${response.status} - ${errorText}`,
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error("R2 upload exception:", error);
    return {
      success: false,
      error: error.message || "Unknown error during upload",
    };
  }
}
