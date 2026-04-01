import { OrgDocumentRequirement, OrgDocumentSubmission } from "@nowgai/shared/models";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { generateOrgDocPresignedUploadUrl } from "~/lib/r2Storage";

// GET /api/organizations/documents
// Fetches active OrgDocumentRequirements
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    const url = new URL(request.url);
    const orgId = url.searchParams.get("organizationId");

    const requirements = await OrgDocumentRequirement.find({ isActive: true })
      .sort({ isMandatory: -1, createdAt: 1 })
      .lean();

    let submissions: any[] = [];
    if (orgId) {
      submissions = await OrgDocumentSubmission.find({ organizationId: orgId }).lean();
    }

    return new Response(JSON.stringify({ requirements, submissions }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error fetching document requirements:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch document requirements" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST /api/organizations/documents
// Handles document submissions and pre-signed URL generation
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;
    await connectToDatabase();
    const body = await request.json();

    // ── Generate presigned URL for upload ──────────────────────────────────
    if (body.action === "getPresignedUploadUrl") {
      const { fileName, contentType } = body;
      
      if (!fileName || !contentType) {
        return new Response(JSON.stringify({ error: "fileName and contentType are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const uploadResult = await generateOrgDocPresignedUploadUrl(
        userId,
        fileName,
        contentType
      );

      if (!uploadResult.success) {
        return new Response(JSON.stringify({ error: uploadResult.error }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(uploadResult), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // ── Submit document ──────────────────────────────────────────────────────
    if (body.action === "submitDocument") {
      const { organizationId, requirementId, fileUrl } = body;

      if (!organizationId || !requirementId || !fileUrl) {
        return new Response(
          JSON.stringify({ error: "organizationId, requirementId, and fileUrl are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const submission = new OrgDocumentSubmission({
        organizationId,
        requirementId,
        fileUrl,
        status: "pending",
        adminNotes: null,
      });

      await submission.save();

      return new Response(JSON.stringify({ success: true, submission }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in POST /api/organizations/documents:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
