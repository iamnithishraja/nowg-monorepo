import { Conversation } from "@nowgai/shared/models";
import { auth } from "../lib/auth";
import { deleteSupabaseProject } from "../lib/supabaseManager";
import type { Route } from "./+types/api.supabase.projects";

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");

    const match: any = conversationId
      ? { _id: conversationId, userId: session.user.id }
      : { userId: session.user.id, "supabase.ref": { $exists: true, $ne: undefined } };

    const conversations = await Conversation.find(match).select(
      "_id title updatedAt supabase"
    );

    const projects = conversations
      .filter((c: any) => c?.supabase?.ref)
      .map((c: any) => ({
        id: c._id.toString(),
        conversationId: c._id.toString(),
        conversationTitle: c.title || "Untitled",
        updatedAt: c.updatedAt,
        ref: c.supabase.ref,
        projectId: c.supabase.projectId,
        supabaseUrl: c.supabase.supabaseUrl,
        createdAt: c.supabase.createdAt,
      }));

    return new Response(
      JSON.stringify({ success: true, projects }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching supabase projects:", error);
    return new Response(JSON.stringify({ success: false, error: "Failed to fetch projects" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function action({ request }: Route.ActionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { conversationId, deleteAll } = body || {};

    if (deleteAll) {
      // Fetch all user's projects first
      const conversations = await Conversation.find({
        userId: session.user.id,
        "supabase.ref": { $exists: true, $ne: undefined },
      }).select("_id supabase");

      const results = await Promise.allSettled(
        conversations.map(async (c: any) => {
          if (c?.supabase?.ref) {
            const ok = await deleteSupabaseProject(c.supabase.ref, session.user.id);
            if (ok) {
              c.supabase = { enabled: false } as any;
              await c.save();
            }
            return ok;
          }
          return true;
        })
      );

      const success = results.every((r) => r.status === "fulfilled" && (r as any).value === true);
      return new Response(JSON.stringify({ success }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversationId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const convo = await Conversation.findOne({ _id: conversationId, userId: session.user.id });
    if (!convo) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!convo?.supabase?.ref) {
      return new Response(JSON.stringify({ success: true, message: "No Supabase project for conversation" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ok = await deleteSupabaseProject(convo.supabase.ref, session.user.id);
    if (ok) {
      convo.supabase = { enabled: false } as any;
      await convo.save();
    }

    return new Response(JSON.stringify({ success: ok }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting Supabase project(s):", error);
    return new Response(JSON.stringify({ success: false, error: "Failed to delete project(s)" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


