// Lightweight Supabase Management API helper
// Uses SUPABASE_ACCESS_TOKEN from environment to create projects and fetch API keys

import { getEnv, getEnvWithDefault } from "./env";

const SUPABASE_API_BASE = "https://api.supabase.com/v1";

export interface ProvisionResult {
  projectId: string;
  ref: string;
  supabaseUrl: string;
  anonKey: string;
}

class SupabaseApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "SupabaseApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Get Supabase access token - prefers user-specific token, falls back to env token
 */
async function getSupabaseAccessToken(userId?: string): Promise<string> {
  // If userId is provided, try to get user-specific token
  if (userId) {
    try {
      const { connectToDatabase } = await import("./mongo");
      const SupabaseIntegration = (
        await import("../models/supabaseIntegrationModel")
      ).default;
      await connectToDatabase();

      const integration = await SupabaseIntegration.findOne({ userId });
      if (integration?.accessToken) {
        return integration.accessToken;
      }
    } catch (error) {
      console.warn(
        "Failed to get user-specific Supabase token, falling back to env token:",
        error
      );
    }
  }

  // Fallback to environment token
  const accessToken = getEnv("SUPABASE_ACCESS_TOKEN");
  if (!accessToken) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is not set and no user-specific token available"
    );
  }
  return accessToken;
}

async function apiRequest(path: string, init?: RequestInit, userId?: string) {
  const accessToken = await getSupabaseAccessToken(userId);

  const res = await fetch(`${SUPABASE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new SupabaseApiError(
      `Supabase API error ${res.status}: ${text}`,
      res.status,
      text
    );
  }
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureOrganizationId(userId?: string): Promise<string> {
  const orgId = getEnv("SUPABASE_ORG_ID");
  if (orgId) return orgId;

  // Always fetch fresh organizations from API to avoid stale organizationId
  // This ensures we use the current organization after user reconnects with a new org
  if (userId) {
    try {
      // Fetch organizations using the user's access token
      const orgs = await apiRequest("/organizations", undefined, userId);

      if (Array.isArray(orgs) && orgs.length > 0) {
        const selectedOrg = orgs[0];
        const orgId =
          selectedOrg.id ||
          selectedOrg.organization_id ||
          selectedOrg.organizationId;

        if (orgId) {
          console.log(
            `✅ Using organization: ${orgId} (${selectedOrg.name || "unnamed"})`
          );

          // Update the stored organizationId in the integration if it changed
          try {
            const { connectToDatabase } = await import("./mongo");
            const SupabaseIntegration = (
              await import("../models/supabaseIntegrationModel")
            ).default;
            await connectToDatabase();

            const integration = await SupabaseIntegration.findOne({ userId });
            if (integration && integration.organizationId !== orgId) {
              console.log(
                `🔄 Updating stored organizationId from ${integration.organizationId} to ${orgId}`
              );
              await SupabaseIntegration.findOneAndUpdate(
                { userId },
                {
                  organizationId: orgId,
                  organizationName:
                    selectedOrg.name || integration.organizationName,
                  lastUsedAt: new Date(),
                }
              );
            }
          } catch (updateError) {
            console.warn(
              "Failed to update organizationId in integration:",
              updateError
            );
            // Continue anyway - we have the correct orgId
          }

          return orgId as string;
        }
      }

      throw new Error("No valid organizations found in API response");
    } catch (error) {
      console.error("Failed to fetch organizations from API:", error);
      // Fallback: try to use stored organizationId as last resort
      try {
        const { connectToDatabase } = await import("./mongo");
        const SupabaseIntegration = (
          await import("../models/supabaseIntegrationModel")
        ).default;
        await connectToDatabase();

        const integration = await SupabaseIntegration.findOne({ userId });
        if (integration?.organizationId) {
          console.warn(
            `⚠️ Using stored organizationId ${integration.organizationId} as fallback`
          );
          return integration.organizationId;
        }
      } catch (fallbackError) {
        console.warn(
          "Fallback to stored organizationId also failed:",
          fallbackError
        );
      }

      throw new Error(
        "No Supabase organizations available for provided token. Please reconnect your Supabase account."
      );
    }
  }

  // Fallback for non-user requests (shouldn't happen in normal flow)
  const orgs = await apiRequest("/organizations", undefined, userId);
  if (!Array.isArray(orgs) || orgs.length === 0) {
    throw new Error("No Supabase organizations available for provided token");
  }
  return orgs[0].id as string;
}

function generateDbPassword(length = 24): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_+=";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function listProjectsForOrg(organizationId: string, userId?: string) {
  // Best-effort listing to find an existing project by name
  try {
    return await apiRequest(
      `/organizations/${organizationId}/projects`,
      { method: "GET" },
      userId
    );
  } catch {
    // Fallback: try global projects listing if org-scoped endpoint is unavailable
    try {
      return await apiRequest(`/projects`, { method: "GET" }, userId);
    } catch {
      return [];
    }
  }
}

function extractProjectIdentifiers(project: any) {
  const ref = project?.ref || project?.project_ref || project?.id;
  const id = project?.id || project?.project_id || ref;
  return { ref, id } as { ref: string | undefined; id: string | undefined };
}

async function findProjectByName(
  organizationId: string,
  name: string,
  userId?: string
) {
  const projects = await listProjectsForOrg(organizationId, userId);
  if (!Array.isArray(projects)) return undefined;
  const match = projects.find(
    (p: any) => (p?.name || "").toLowerCase() === name.toLowerCase()
  );
  if (!match) return undefined;
  const { ref, id } = extractProjectIdentifiers(match);
  if (!ref) return undefined;
  return { ref, projectId: id as string } as { ref: string; projectId: string };
}

async function fetchAnonKeyWithRetry(
  ref: string,
  timeoutMs = 120000,
  intervalMs = 3000,
  userId?: string
): Promise<string> {
  const start = Date.now();
  let lastError: any = undefined;
  while (Date.now() - start < timeoutMs) {
    try {
      const keysResp = await apiRequest(
        `/projects/${ref}/api-keys`,
        { method: "GET" },
        userId
      );

      // Handle different response formats
      let anonKey: string | undefined;

      if (Array.isArray(keysResp)) {
        // Find anon key by checking multiple possible fields
        const anon = keysResp.find((k: any) => {
          const name = (k.name || "").toLowerCase();
          const description = (k.description || "").toLowerCase();
          const type = (k.type || "").toLowerCase();
          const role = (k.role || "").toLowerCase();

          return (
            name.includes("anon") ||
            description.includes("anon") ||
            role === "anon" ||
            role === "anonymous" ||
            (type === "legacy" &&
              (name.includes("anon") || description.includes("anon")))
          );
        });

        anonKey = anon?.api_key || anon?.key || anon;
      } else if (keysResp && typeof keysResp === "object") {
        // Handle object response format
        anonKey =
          keysResp.anonKey ||
          keysResp.anon_key ||
          keysResp.anon ||
          keysResp.api_key;
      } else if (typeof keysResp === "string") {
        // Direct string response
        anonKey = keysResp;
      }

      if (anonKey && typeof anonKey === "string" && anonKey.length > 0) {
        console.log(`✅ Successfully fetched anon key for project ${ref}`);
        return anonKey;
      }

      lastError = new Error(
        "Anon key not available yet - project may still be provisioning"
      );
    } catch (e: any) {
      lastError = e;
      // If it's a 404, the project might still be provisioning
      if (e?.status === 404) {
        console.log(`⏳ Project ${ref} not ready yet, retrying...`);
      } else {
        console.warn(`⚠️ Error fetching anon key for ${ref}:`, e?.message || e);
      }
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Failed to fetch Supabase anon key within timeout: ${
      lastError?.message || lastError
    }`
  );
}

async function fetchServiceRoleKeyWithRetry(
  ref: string,
  timeoutMs = 120000,
  intervalMs = 3000,
  userId?: string
): Promise<string> {
  const start = Date.now();
  let lastError: any = undefined;
  while (Date.now() - start < timeoutMs) {
    try {
      const keysResp = await apiRequest(
        `/projects/${ref}/api-keys`,
        { method: "GET" },
        userId
      );
      const service = Array.isArray(keysResp)
        ? keysResp.find(
            (k: any) =>
              k.name?.toLowerCase().includes("service") ||
              k.role === "service" ||
              k.role === "service_role"
          )
        : keysResp?.serviceKey || keysResp?.service_key;
      const serviceKey =
        typeof service === "string"
          ? service
          : service?.api_key || service?.key;
      if (serviceKey) {
        return serviceKey as string;
      }
      lastError = new Error("Service role key not available yet");
    } catch (e) {
      lastError = e;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Failed to fetch Supabase service role key within timeout: ${
      lastError?.message || lastError
    }`
  );
}

async function enableAuthAutoConfirm(ref: string, userId?: string) {
  // Best-effort: attempt to enable autoconfirm so users can sign in without email verification
  try {
    const serviceKey = await fetchServiceRoleKeyWithRetry(
      ref,
      120000,
      3000,
      userId
    );
    const supabaseUrl = `https://${ref}.supabase.co`;

    const commonHeaders = {
      "Content-Type": "application/json",
      // GoTrue expects both apikey and Authorization with service role
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    } as Record<string, string>;

    // Try PUT then PATCH to cover variations
    const body = JSON.stringify({ mailer_autoconfirm: true });
    const endpoints = [
      { method: "PUT", url: `${supabaseUrl}/auth/v1/settings` },
      { method: "PATCH", url: `${supabaseUrl}/auth/v1/settings` },
    ] as const;

    for (const { method, url } of endpoints) {
      try {
        const res = await fetch(url, { method, headers: commonHeaders, body });
        if (res.ok) return;
      } catch {
        // Ignore and try next strategy
      }
    }

    // Fallback: try Management API auth config endpoint (not all tokens have access)
    try {
      await apiRequest(
        `/projects/${ref}/config/auth`,
        {
          method: "PATCH",
          body: JSON.stringify({
            mailer_autoconfirm: true,
            MAILER_AUTOCONFIRM: true,
          }),
        },
        userId
      );
    } catch {
      // Swallow errors; provisioning should continue even if this best-effort step fails
    }
  } catch {
    // Ignore errors here to avoid blocking provisioning; users can toggle manually if needed
  }
}

export async function provisionSupabaseForConversation(
  conversationId: string,
  userId?: string
): Promise<ProvisionResult> {
  const organizationId = await ensureOrganizationId(userId);
  const region = getEnvWithDefault("SUPABASE_DB_REGION", "us-east-1");
  const name = `nowgai-${conversationId}`.slice(0, 50);
  const dbPass = generateDbPassword();

  // Idempotency: try to find an existing project with this name first
  let existing = await findProjectByName(organizationId, name, userId);

  // If not found, attempt to create. Handle race/duplicate by falling back to lookup on error
  if (!existing) {
    try {
      const createResp = await apiRequest(
        "/projects",
        {
          method: "POST",
          body: JSON.stringify({
            organization_id: organizationId,
            name,
            db_pass: dbPass,
            region,
            plan: "free",
          }),
        },
        userId
      );
      const createdRef = (createResp?.ref ||
        createResp?.project_ref ||
        createResp?.id) as string | undefined;
      const createdId = (createResp?.id ||
        createResp?.project_id ||
        createdRef) as string | undefined;
      if (createdRef && createdId) {
        existing = { ref: createdRef, projectId: createdId };
      } else {
        // If API response is weird, try to find by name as a fallback
        existing = await findProjectByName(organizationId, name, userId);
      }
    } catch (e: any) {
      // If creation failed (e.g., name conflict or transient), try to find the project by name
      existing = await findProjectByName(organizationId, name, userId);
      if (!existing) {
        // Detect plan/project limit to surface a clearer error upstream
        const message: string = e?.message || "";
        const status: number | undefined = e?.status;
        const body: string = e?.body || "";
        const looksLikeLimit =
          status === 402 ||
          /limit|quota|maximum|max\s+number\s+of\s+projects/i.test(message) ||
          /limit|quota|maximum|max\s+number\s+of\s+projects/i.test(body);
        if (looksLikeLimit) {
          const err = new Error(
            "PROJECT_LIMIT_REACHED: Supabase org has reached its project limit."
          );
          (err as any).code = "PROJECT_LIMIT_REACHED";
          throw err;
        }
        throw e;
      }
    }
  }

  if (!existing?.ref || !existing?.projectId) {
    throw new Error("Failed to create or locate Supabase project");
  }

  const ref = existing.ref;
  const projectId = existing.projectId;

  console.log(`🔄 Automatically fetching anon key for project ${ref}...`);

  // Fetch anon key with retry (project can take time to be fully provisioned)
  // This is done automatically using the user's OAuth token from Supabase integration
  const anonKey = await fetchAnonKeyWithRetry(ref, 120000, 3000, userId);

  console.log(`✅ Anon key automatically retrieved for project ${ref}`);

  // Best-effort: disable email confirmations for the provisioned project
  enableAuthAutoConfirm(ref, userId).catch(() => {});

  // Derive URL from ref
  const supabaseUrl = `https://${ref}.supabase.co`;

  console.log(`✅ Supabase project fully provisioned:`, {
    ref,
    projectId,
    supabaseUrl,
    anonKeyLength: anonKey.length,
  });

  return {
    projectId,
    ref,
    supabaseUrl,
    anonKey,
  };
}

export async function fetchTablesFromSupabase(ref: string, userId?: string) {
  const serviceKey = await fetchServiceRoleKeyWithRetry(
    ref,
    120000,
    3000,
    userId
  );
  const supabaseUrl = `https://${ref}.supabase.co`;

  const commonTables = [
    "users",
    "profiles",
    "posts",
    "comments",
    "items",
    "products",
    "todos",
    "tasks",
  ];

  const foundTables: any[] = [];

  // Try to detect tables by checking if they exist
  for (const tableName of commonTables) {
    try {
      const testUrl = `${supabaseUrl}/rest/v1/${tableName}?select=*&limit=0`;

      const res = await fetch(testUrl, {
        method: "HEAD",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
      });

      // If we get 200 or 206, the table exists (206 = Partial Content with data)
      // 404 = table doesn't exist
      if (res.status === 200 || res.status === 206) {
        foundTables.push({
          table_schema: "public",
          table_name: tableName,
        });
      }
    } catch (e) {
      // Table doesn't exist, continue
    }
  }

  try {
    const schemaUrl = `${supabaseUrl}/rest/v1/rpc/get_table_list`;

    const rpcRes = await fetch(schemaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (rpcRes.ok) {
      const data = await rpcRes.json();

      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (e) {
    // Ignore
  }

  return foundTables;
}

export async function fetchRowsFromSupabase(
  ref: string,
  schema: string,
  table: string,
  limit = 50,
  offset = 0,
  userId?: string
) {
  const serviceKey = await fetchServiceRoleKeyWithRetry(
    ref,
    120000,
    3000,
    userId
  );
  const supabaseUrl = `https://${ref}.supabase.co`;

  // PostgREST URL format: for default schema "public", just use table name
  // For other schemas, use schema.table_name
  const tablePath =
    schema === "public" || !schema ? table : `${schema}.${table}`;
  const url = `${supabaseUrl}/rest/v1/${tablePath}?select=*&limit=${limit}&offset=${offset}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();

      throw new Error(`Failed to fetch rows: ${res.status} - ${errorText}`);
    }

    const data = await res.json();

    const contentRange = res.headers.get("content-range");

    const total = contentRange
      ? parseInt(contentRange.split("/")[1] || "0")
      : data.length;

    return { rows: data, total };
  } catch (e: any) {
    throw e;
  }
}

export async function createRowInSupabase(
  ref: string,
  schema: string,
  table: string,
  data: Record<string, any>,
  userId?: string
) {
  const serviceKey = await fetchServiceRoleKeyWithRetry(
    ref,
    120000,
    3000,
    userId
  );
  const supabaseUrl = `https://${ref}.supabase.co`;

  const tablePath =
    schema === "public" || !schema ? table : `${schema}.${table}`;
  const url = `${supabaseUrl}/rest/v1/${tablePath}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create row: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    return Array.isArray(result) ? result[0] : result;
  } catch (e: any) {
    throw e;
  }
}

export async function updateRowInSupabase(
  ref: string,
  schema: string,
  table: string,
  primaryKey: string,
  primaryValue: any,
  data: Record<string, any>,
  userId?: string
) {
  const serviceKey = await fetchServiceRoleKeyWithRetry(
    ref,
    120000,
    3000,
    userId
  );
  const supabaseUrl = `https://${ref}.supabase.co`;

  const tablePath =
    schema === "public" || !schema ? table : `${schema}.${table}`;
  const url = `${supabaseUrl}/rest/v1/${tablePath}?${primaryKey}=eq.${encodeURIComponent(
    primaryValue
  )}`;

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to update row: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    return Array.isArray(result) ? result[0] : result;
  } catch (e: any) {
    throw e;
  }
}

export async function deleteRowFromSupabase(
  ref: string,
  schema: string,
  table: string,
  primaryKey: string,
  primaryValue: any,
  userId?: string
) {
  const serviceKey = await fetchServiceRoleKeyWithRetry(
    ref,
    120000,
    3000,
    userId
  );
  const supabaseUrl = `https://${ref}.supabase.co`;

  const tablePath =
    schema === "public" || !schema ? table : `${schema}.${table}`;
  const url = `${supabaseUrl}/rest/v1/${tablePath}?${primaryKey}=eq.${encodeURIComponent(
    primaryValue
  )}`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to delete row: ${res.status} - ${errorText}`);
    }

    return true;
  } catch (e: any) {
    throw e;
  }
}

export async function executeSQL(ref: string, sql: string, userId?: string) {
  // Legacy function - use fetchTablesFromSupabase or fetchRowsFromSupabase instead
  const accessToken = await getSupabaseAccessToken(userId);
  const res = await fetch(
    `${SUPABASE_API_BASE}/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: sql,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SQL execution failed ${res.status}: ${text}`);
  }
  return res.json();
}

export async function deleteSupabaseProject(
  ref: string,
  userId?: string
): Promise<boolean> {
  try {
    const accessToken = await getSupabaseAccessToken(userId);
    if (!accessToken) {
      console.error(
        "SUPABASE_ACCESS_TOKEN is not set and no user-specific token available"
      );
      return false;
    }

    // First, try to pause the project (this is safer than immediate deletion)
    try {
      await apiRequest(
        `/projects/${ref}/pause`,
        {
          method: "POST",
        },
        userId
      );
    } catch (pauseError) {
      // Continue with deletion attempt even if pause fails
    }

    // Delete the project
    await apiRequest(
      `/projects/${ref}`,
      {
        method: "DELETE",
      },
      userId
    );

    return true;
  } catch (error: any) {
    console.error(`Failed to delete Supabase project ${ref}:`, error);

    // Check if project was already deleted or doesn't exist
    if (error.status === 404 || error.status === 400) {
      return true; // Consider this a success since the end result is the same
    }

    return false;
  }
}
