import { hasAdminAccess } from "@nowgai/shared/types";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";
import Organization from "~/models/organizationModel";
import Project from "~/models/projectModel";

export async function action({ request }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const adminUser = await requireAdmin(request);

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { type, entityId, imageData, imageName, imageType } = body;

    // Validate required fields
    if (!type || !["organization", "project"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be 'organization' or 'project'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!entityId || !ObjectId.isValid(entityId)) {
      return new Response(
        JSON.stringify({ error: "Invalid entity ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate image type
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"];
    if (imageType && !allowedMimeTypes.includes(imageType)) {
      return new Response(
        JSON.stringify({ error: "Invalid image type. Allowed: PNG, JPEG, GIF, WebP, SVG" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions based on type
    if (type === "organization") {
      const organization = await Organization.findById(entityId);
      if (!organization) {
        return new Response(
          JSON.stringify({ error: "Organization not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if user has org admin access or is system admin
      const hasOrgAccess = await isOrganizationAdmin(adminUser.id, entityId);
      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({ error: "You don't have permission to upload logo for this organization" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } else if (type === "project") {
      const project = await Project.findById(entityId);
      if (!project) {
        return new Response(
          JSON.stringify({ error: "Project not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if user has project admin access, org admin access, or is system admin
      const hasProjectAccess = await isProjectAdmin(adminUser.id, entityId);
      const hasOrgAccess = await isOrganizationAdmin(adminUser.id, project.organizationId.toString());
      if (!hasProjectAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({ error: "You don't have permission to upload image for this project" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get R2 configuration
    const r2Endpoint = getEnvWithDefault("R2_ENDPOINT", "");
    const r2AccessKey = getEnvWithDefault("R2_ACCESS_KEY", "");
    const r2SecretKey = getEnvWithDefault("R2_SECRET_KEY", "");
    const r2BucketName = getEnvWithDefault("R2_BUCKET_NAME", "");
    const r2PublicBaseUrl = getEnvWithDefault("R2_PUBLIC_BASE_URL", "");

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey || !r2BucketName) {
      console.error("R2 configuration is incomplete");
      return new Response(
        JSON.stringify({ error: "Storage configuration is incomplete" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
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
    const objectKey = `${type}s/${entityId}/${timestamp}-${randomId}-${sanitizedName}${extension}`;

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
      return new Response(
        JSON.stringify({ error: "Failed to upload image", details: uploadResult.error }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Construct public URL
    const publicUrl = r2PublicBaseUrl
      ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`
      : `${r2Endpoint}/${r2BucketName}/${objectKey}`;

    // Update the entity with the new logo/image URL
    if (type === "organization") {
      await Organization.findByIdAndUpdate(entityId, {
        logoUrl: publicUrl,
        updatedAt: new Date(),
      });
    } else if (type === "project") {
      await Project.findByIdAndUpdate(entityId, {
        imageUrl: publicUrl,
        updatedAt: new Date(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        objectKey,
        message: `${type === "organization" ? "Logo" : "Image"} uploaded successfully`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error uploading image:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to upload image",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
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

    // Create canonical request
    const canonicalUri = `/${bucketName}/${objectKey}`;
    const canonicalQueryString = "";
    const canonicalHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .map((k) => `${k}:${headers[k.split("-").map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join("-")] || headers[k.charAt(0).toUpperCase() + k.slice(1)] || headers[k]}`)
      .join("\n") + "\n";

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

    // Make the request (convert Buffer to Uint8Array for fetch compatibility)
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

/**
 * DELETE /api/admin/upload-image
 * Delete an image from R2
 */
export async function loader({ request }: ActionFunctionArgs) {
  // This endpoint only supports POST for uploads
  return new Response(
    JSON.stringify({
      error: "Method not allowed. Use POST to upload images.",
      usage: {
        method: "POST",
        body: {
          type: "organization | project",
          entityId: "string (ObjectId)",
          imageData: "string (base64 encoded image)",
          imageName: "string (optional, original filename)",
          imageType: "string (optional, MIME type e.g., image/png)",
        },
      },
    }),
    {
      status: 405,
      headers: { "Content-Type": "application/json" },
    }
  );
}
