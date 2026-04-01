import crypto from "crypto";
import { getEnvWithDefault } from "./env";

/**
 * Upload file to R2 bucket
 * Structure: users/{userId}/projects/{projectId}/conversations/{conversationId}/files/{filename}
 * If projectId is not provided, uses: users/{userId}/conversations/{conversationId}/files/{filename}
 */
export async function uploadFileToR2(
  userId: string,
  conversationId: string,
  fileData: Buffer,
  fileName: string,
  contentType: string,
  projectId?: string,
  filePath?: string, // Optional file path - if provided, uses this for consistent object key (overwrites)
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Get R2 configuration
    const r2Endpoint = getEnvWithDefault("R2_ENDPOINT", "");
    const r2AccessKey = getEnvWithDefault("R2_ACCESS_KEY", "");
    const r2SecretKey = getEnvWithDefault("R2_SECRET_KEY", "");
    const r2BucketName = getEnvWithDefault("R2_BUCKET_NAME", "");
    const r2PublicBaseUrl = getEnvWithDefault("R2_PUBLIC_BASE_URL", "");

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey || !r2BucketName) {
      console.error("R2 configuration is incomplete");
      return { success: false, error: "R2 configuration is incomplete" };
    }

    // Use filePath if provided (for overwriting), otherwise use fileName
    // Normalize the path: remove leading slashes, normalize separators, sanitize special chars
    const pathToUse = filePath || fileName;
    const sanitizedPath = pathToUse
      .replace(/^\/+/, "") // Remove leading slashes
      .replace(/\/+/g, "/") // Normalize multiple slashes to single
      .replace(/[^a-zA-Z0-9./_-]/g, "_") // Replace special chars with underscore
      .substring(0, 200); // Limit length

    // Build object key using the file path (same path = same key = overwrites existing file)
    const objectKey = projectId
      ? `users/${userId}/projects/${projectId}/conversations/${conversationId}/files/${sanitizedPath}`
      : `users/${userId}/conversations/${conversationId}/files/${sanitizedPath}`;

    // Upload to R2 using S3-compatible API
    const uploadResult = await uploadToR2({
      endpoint: r2Endpoint,
      accessKey: r2AccessKey,
      secretKey: r2SecretKey,
      bucketName: r2BucketName,
      objectKey,
      fileBuffer: fileData,
      contentType,
    });

    if (!uploadResult.success) {
      console.error("Failed to upload to R2:", uploadResult.error);
      return { success: false, error: uploadResult.error };
    }

    // Construct public URL
    const publicUrl = r2PublicBaseUrl
      ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`
      : `${r2Endpoint}/${r2BucketName}/${objectKey}`;

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error("Error uploading file to R2:", error.message);
    return {
      success: false,
      error: error.message || "Unknown error during upload",
    };
  }
}

/**
 * Upload file to R2 using S3-compatible API
 */
async function uploadToR2({
  endpoint,
  accessKey,
  secretKey,
  bucketName,
  objectKey,
  fileBuffer,
  contentType,
}: {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  objectKey: string;
  fileBuffer: Buffer;
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
      .update(fileBuffer)
      .digest("hex");

    // Create canonical headers
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": fileBuffer.length.toString(),
      Host: host,
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

    const canonicalHeadersStr =
      sortedHeaderKeys
        .map((k) => {
          const originalKey = Object.keys(headers).find(
            (hk) => hk.toLowerCase() === k,
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
      serviceName: string,
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
      body: new Uint8Array(fileBuffer),
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
 * Generate a pre-signed URL for uploading a file directly to R2 from the frontend
 * This offloads the upload bandwidth from the server to the client
 */
export async function generatePresignedUploadUrl(
  userId: string,
  conversationId: string,
  fileName: string,
  contentType: string,
  projectId?: string,
  filePath?: string,
  expiresInSeconds: number = 3600, // 1 hour default
): Promise<{
  success: boolean;
  uploadUrl?: string;
  publicUrl?: string;
  objectKey?: string;
  error?: string;
}> {
  try {
    // Get R2 configuration
    const r2Endpoint = getEnvWithDefault("R2_ENDPOINT", "");
    const r2AccessKey = getEnvWithDefault("R2_ACCESS_KEY", "");
    const r2SecretKey = getEnvWithDefault("R2_SECRET_KEY", "");
    const r2BucketName = getEnvWithDefault("R2_BUCKET_NAME", "");
    const r2PublicBaseUrl = getEnvWithDefault("R2_PUBLIC_BASE_URL", "");

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey || !r2BucketName) {
      console.error("R2 configuration is incomplete");
      return { success: false, error: "R2 configuration is incomplete" };
    }

    // Normalize the path
    const pathToUse = filePath || fileName;
    const sanitizedPath = pathToUse
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/")
      .replace(/[^a-zA-Z0-9./_-]/g, "_")
      .substring(0, 200);

    // Build object key
    const objectKey = projectId
      ? `users/${userId}/projects/${projectId}/conversations/${conversationId}/files/${sanitizedPath}`
      : `users/${userId}/conversations/${conversationId}/files/${sanitizedPath}`;

    // Generate pre-signed URL using AWS Signature V4
    const endpointUrl = new URL(r2Endpoint);
    const host = endpointUrl.host;
    const region = "auto";
    const service = "s3";

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    // Query parameters for pre-signed URL
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${r2AccessKey}/${credentialScope}`;

    // Build canonical query string (alphabetically sorted)
    const queryParams: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": credential,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": expiresInSeconds.toString(),
      "X-Amz-SignedHeaders": "host",
    };

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join("&");

    // Canonical URI (URL-encoded path)
    const canonicalUri = `/${r2BucketName}/${objectKey}`;

    // Canonical headers
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = "host";

    // For pre-signed URLs, payload is UNSIGNED-PAYLOAD
    const payloadHash = "UNSIGNED-PAYLOAD";

    // Create canonical request
    const canonicalRequest = [
      "PUT",
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    // Create string to sign
    const algorithm = "AWS4-HMAC-SHA256";
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
      serviceName: string,
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

    const signingKey = getSignatureKey(r2SecretKey, dateStamp, region, service);
    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    // Construct the pre-signed URL
    const uploadUrl = `${r2Endpoint}/${r2BucketName}/${objectKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    // Construct public URL for after upload
    const publicUrl = r2PublicBaseUrl
      ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`
      : `${r2Endpoint}/${r2BucketName}/${objectKey}`;

    return {
      success: true,
      uploadUrl,
      publicUrl,
      objectKey,
    };
  } catch (error: any) {
    console.error("Error generating pre-signed URL:", error.message);
    return {
      success: false,
      error: error.message || "Unknown error generating pre-signed URL",
    };
  }
}

/**
 * Generate a pre-signed URL for uploading an organization request document
 */
export async function generateOrgDocPresignedUploadUrl(
  userId: string,
  fileName: string,
  contentType: string,
  expiresInSeconds: number = 3600,
): Promise<{
  success: boolean;
  uploadUrl?: string;
  publicUrl?: string;
  objectKey?: string;
  error?: string;
}> {
  try {
    // Get R2 configuration
    const r2Endpoint = getEnvWithDefault("R2_ENDPOINT", "");
    const r2AccessKey = getEnvWithDefault("R2_ACCESS_KEY", "");
    const r2SecretKey = getEnvWithDefault("R2_SECRET_KEY", "");
    const r2BucketName = getEnvWithDefault("R2_BUCKET_NAME", "");
    const r2PublicBaseUrl = getEnvWithDefault("R2_PUBLIC_BASE_URL", "");

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey || !r2BucketName) {
      console.error("R2 configuration is incomplete");
      return { success: false, error: "R2 configuration is incomplete" };
    }

    // Normalize the path
    const sanitizedPath = fileName
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/")
      .replace(/[^a-zA-Z0-9./_-]/g, "_")
      .substring(0, 200);

    const uniqueId = crypto.randomBytes(4).toString('hex');
    const objectKey = `users/${userId}/org-documents/${uniqueId}-${sanitizedPath}`;

    // Generate pre-signed URL using AWS Signature V4
    const endpointUrl = new URL(r2Endpoint);
    const host = endpointUrl.host;
    const region = "auto";
    const service = "s3";

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    // Query parameters for pre-signed URL
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${r2AccessKey}/${credentialScope}`;

    // Build canonical query string (alphabetically sorted)
    const queryParams: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": credential,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": expiresInSeconds.toString(),
      "X-Amz-SignedHeaders": "host",
    };

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join("&");

    const canonicalUri = `/${r2BucketName}/${objectKey}`;
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = "host";
    const payloadHash = "UNSIGNED-PAYLOAD";

    const canonicalRequest = [
      "PUT",
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
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

    const getSignatureKey = (
      key: string,
      dateStamp: string,
      regionName: string,
      serviceName: string,
    ): Buffer => {
      const kDate = crypto.createHmac("sha256", `AWS4${key}`).update(dateStamp).digest();
      const kRegion = crypto.createHmac("sha256", kDate).update(regionName).digest();
      const kService = crypto.createHmac("sha256", kRegion).update(serviceName).digest();
      return crypto.createHmac("sha256", kService).update("aws4_request").digest();
    };

    const signingKey = getSignatureKey(r2SecretKey, dateStamp, region, service);
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    const uploadUrl = `${r2Endpoint}/${r2BucketName}/${objectKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    const publicUrl = r2PublicBaseUrl
      ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`
      : `${r2Endpoint}/${r2BucketName}/${objectKey}`;

    return {
      success: true,
      uploadUrl,
      publicUrl,
      objectKey,
    };
  } catch (error: any) {
    console.error("Error generating pre-signed URL:", error.message);
    return {
      success: false,
      error: error.message || "Unknown error generating pre-signed URL",
    };
  }
}

/**
 * Generate pre-signed URLs for multiple files at once
 */
export async function generatePresignedUploadUrls(
  userId: string,
  conversationId: string,
  files: Array<{
    fileName: string;
    contentType: string;
    filePath?: string;
  }>,
  projectId?: string,
  expiresInSeconds: number = 3600,
): Promise<{
  success: boolean;
  urls?: Array<{
    fileName: string;
    filePath: string;
    uploadUrl: string;
    publicUrl: string;
    objectKey: string;
    contentType: string;
  }>;
  error?: string;
}> {
  try {
    const urls: Array<{
      fileName: string;
      filePath: string;
      uploadUrl: string;
      publicUrl: string;
      objectKey: string;
      contentType: string;
    }> = [];

    for (const file of files) {
      const result = await generatePresignedUploadUrl(
        userId,
        conversationId,
        file.fileName,
        file.contentType,
        projectId,
        file.filePath,
        expiresInSeconds,
      );

      if (result.success && result.uploadUrl && result.publicUrl && result.objectKey) {
        urls.push({
          fileName: file.fileName,
          filePath: file.filePath || file.fileName,
          uploadUrl: result.uploadUrl,
          publicUrl: result.publicUrl,
          objectKey: result.objectKey,
          contentType: file.contentType,
        });
      }
    }

    return { success: true, urls };
  } catch (error: any) {
    console.error("Error generating pre-signed URLs:", error.message);
    return {
      success: false,
      error: error.message || "Unknown error generating pre-signed URLs",
    };
  }
}

/**
 * Sync conversation data to R2 bucket
 * Structure: users/{userId}/conversations/{conversationId}/conversation.json
 * If projectId is provided, uses: users/{userId}/projects/{projectId}/conversations/{conversationId}/conversation.json
 * This always updates the same location (sync) instead of creating new buckets
 */
export async function syncConversationToR2(
  userId: string,
  conversationId: string,
  conversationData: any,
  projectId?: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Get R2 configuration
    const r2Endpoint = getEnvWithDefault("R2_ENDPOINT", "");
    const r2AccessKey = getEnvWithDefault("R2_ACCESS_KEY", "");
    const r2SecretKey = getEnvWithDefault("R2_SECRET_KEY", "");
    const r2BucketName = getEnvWithDefault("R2_BUCKET_NAME", "");
    const r2PublicBaseUrl = getEnvWithDefault("R2_PUBLIC_BASE_URL", "");

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey || !r2BucketName) {
      console.error("R2 configuration is incomplete");
      return { success: false, error: "R2 configuration is incomplete" };
    }

    // Build object key with consistent location (same for all updates)
    const objectKey = projectId
      ? `users/${userId}/projects/${projectId}/conversations/${conversationId}/conversation.json`
      : `users/${userId}/conversations/${conversationId}/conversation.json`;

    // Serialize conversation data to JSON
    const jsonData = JSON.stringify(conversationData, null, 2);
    const fileBuffer = Buffer.from(jsonData, "utf-8");

    // Upload to R2 using S3-compatible API (PUT will overwrite existing object)
    const uploadResult = await uploadToR2({
      endpoint: r2Endpoint,
      accessKey: r2AccessKey,
      secretKey: r2SecretKey,
      bucketName: r2BucketName,
      objectKey,
      fileBuffer,
      contentType: "application/json",
    });

    if (!uploadResult.success) {
      console.error("Failed to sync conversation to R2:", uploadResult.error);
      return { success: false, error: uploadResult.error };
    }

    // Construct public URL
    const publicUrl = r2PublicBaseUrl
      ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`
      : `${r2Endpoint}/${r2BucketName}/${objectKey}`;

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error("Error syncing conversation to R2:", error.message);
    return {
      success: false,
      error: error.message || "Unknown error during sync",
    };
  }
}

/**
 * Fetch conversation data from R2 bucket
 * Structure: users/{userId}/conversations/{conversationId}/conversation.json
 * If projectId is provided, uses: users/{userId}/projects/{projectId}/conversations/{conversationId}/conversation.json
 */
export async function getConversationFromR2(
  userId: string,
  conversationId: string,
  projectId?: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Get R2 configuration
    const r2Endpoint = getEnvWithDefault("R2_ENDPOINT", "");
    const r2AccessKey = getEnvWithDefault("R2_ACCESS_KEY", "");
    const r2SecretKey = getEnvWithDefault("R2_SECRET_KEY", "");
    const r2BucketName = getEnvWithDefault("R2_BUCKET_NAME", "");

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey || !r2BucketName) {
      console.error("R2 configuration is incomplete");
      return { success: false, error: "R2 configuration is incomplete" };
    }

    // Build object key with consistent location
    const objectKey = projectId
      ? `users/${userId}/projects/${projectId}/conversations/${conversationId}/conversation.json`
      : `users/${userId}/conversations/${conversationId}/conversation.json`;

    // Fetch from R2 using S3-compatible API (GET request)
    const result = await getFromR2({
      endpoint: r2Endpoint,
      accessKey: r2AccessKey,
      secretKey: r2SecretKey,
      bucketName: r2BucketName,
      objectKey,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Parse JSON data
    try {
      const conversationData = JSON.parse(result.data);
      return { success: true, data: conversationData };
    } catch (parseError: any) {
      return {
        success: false,
        error: `Failed to parse conversation data: ${parseError.message}`,
      };
    }
  } catch (error: any) {
    console.error("Error fetching conversation from R2:", error.message);
    return {
      success: false,
      error: error.message || "Unknown error during fetch",
    };
  }
}

/**
 * Get file from R2 using S3-compatible API
 */
async function getFromR2({
  endpoint,
  accessKey,
  secretKey,
  bucketName,
  objectKey,
}: {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  objectKey: string;
}): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    // Parse endpoint to get host
    const endpointUrl = new URL(endpoint);
    const host = endpointUrl.host;
    const region = "auto"; // R2 uses 'auto' for region
    const service = "s3";

    // Prepare request details
    const method = "GET";
    const url = `${endpoint}/${bucketName}/${objectKey}`;
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    // Create payload hash (empty for GET)
    const payloadHash = crypto.createHash("sha256").update("").digest("hex");

    // Create canonical headers
    const headers: Record<string, string> = {
      Host: host,
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

    const canonicalHeadersStr =
      sortedHeaderKeys
        .map((k) => {
          const originalKey = Object.keys(headers).find(
            (hk) => hk.toLowerCase() === k,
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
      serviceName: string,
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
      method: "GET",
      headers: {
        ...headers,
        Authorization: authorization,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "Conversation not found in R2" };
      }
      const errorText = await response.text();
      console.error("R2 fetch error:", response.status, errorText);
      return {
        success: false,
        error: `R2 fetch failed: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.text();
    return { success: true, data };
  } catch (error: any) {
    console.error("R2 fetch exception:", error);
    return {
      success: false,
      error: error.message || "Unknown error during fetch",
    };
  }
}

/**
 * Fetch file content from R2 using the file URL
 */
export async function fetchFileFromR2(
  fileUrl: string,
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    // Get R2 configuration
    const r2Endpoint = getEnvWithDefault("R2_ENDPOINT", "");
    const r2AccessKey = getEnvWithDefault("R2_ACCESS_KEY", "");
    const r2SecretKey = getEnvWithDefault("R2_SECRET_KEY", "");
    const r2BucketName = getEnvWithDefault("R2_BUCKET_NAME", "");
    const r2PublicBaseUrl = getEnvWithDefault("R2_PUBLIC_BASE_URL", "");

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey || !r2BucketName) {
      return { success: false, error: "R2 configuration is incomplete" };
    }

    // Extract object key from URL
    // URL format: {r2PublicBaseUrl}/{objectKey} or {r2Endpoint}/{bucketName}/{objectKey}
    let objectKey = "";
    if (r2PublicBaseUrl && fileUrl.startsWith(r2PublicBaseUrl)) {
      objectKey = fileUrl.replace(r2PublicBaseUrl, "").replace(/^\//, "");
    } else if (fileUrl.includes(`/${r2BucketName}/`)) {
      objectKey = fileUrl.split(`/${r2BucketName}/`)[1];
    } else {
      // Try to extract from URL path
      const urlObj = new URL(fileUrl);
      const pathParts = urlObj.pathname.split("/");
      const bucketIndex = pathParts.findIndex((p) => p === r2BucketName);
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        objectKey = pathParts.slice(bucketIndex + 1).join("/");
      } else {
        return {
          success: false,
          error: "Could not extract object key from URL",
        };
      }
    }

    // Fetch from R2
    const result = await getFromR2({
      endpoint: r2Endpoint,
      accessKey: r2AccessKey,
      secretKey: r2SecretKey,
      bucketName: r2BucketName,
      objectKey,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error || "Failed to fetch file" };
    }

    return { success: true, content: result.data };
  } catch (error: any) {
    console.error("Error fetching file from R2:", error.message);
    return {
      success: false,
      error: error.message || "Unknown error during file fetch",
    };
  }
}

/**
 * Check if a file should be ignored (node_modules, package-lock.json, etc.)
 */
export function shouldIgnoreFile(fileName: string): boolean {
  const ignorePatterns = [
    /node_modules/,
    /package-lock\.json$/i,
    /\.lock$/i,
    /\.log$/i,
  ];

  return ignorePatterns.some((pattern) => pattern.test(fileName));
}
