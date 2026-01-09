import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "../lib/auth";
import { VersionSnapshotService } from "../lib/versionSnapshotService";

const versionService = new VersionSnapshotService();

export async function loader({ request }: LoaderFunctionArgs) {
  try {
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

    const url = new URL(request.url);
    const versionId = url.searchParams.get("versionId");

    // If versionId is provided, return that specific version's files
    if (versionId) {
      const version = await versionService.get(versionId, session.user.id);
      if (!version) {
        return new Response(JSON.stringify({ error: "Version not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          version: {
            id: version.id,
            label: version.label,
            files: version.files,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const conversationId = url.searchParams.get("conversationId");
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId or versionId is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const versions = await versionService.list(conversationId, session.user.id);

    return new Response(JSON.stringify({ versions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to load conversation versions:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
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

    const body = await request.json();
    const { action: actionType, conversationId, payload } = body;

    if (actionType !== "create") {
      return new Response(JSON.stringify({ error: "Unsupported action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!conversationId || !payload) {
      return new Response(
        JSON.stringify({ error: "conversationId and payload are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!payload.files || !Array.isArray(payload.files)) {
      return new Response(JSON.stringify({ error: "files are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const version = await versionService.create(
      conversationId,
      session.user.id,
      payload
    );

    return new Response(JSON.stringify({ version }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to create conversation version:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
