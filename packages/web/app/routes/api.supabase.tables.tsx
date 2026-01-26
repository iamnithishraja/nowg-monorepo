import { Conversation } from "@nowgai/shared/models";
import type { LoaderFunctionArgs } from "react-router";
import { auth } from "../lib/auth";
import { fetchTablesFromSupabase } from "../lib/supabaseManager";

/**
 * GET /api/supabase/tables?conversationId=... (preferred) OR ?ref=...
 * Returns list of tables grouped by schema.
 */
export async function loader({ request }: LoaderFunctionArgs) {
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
    const conversationId = url.searchParams.get("conversationId") || undefined;
    const refParam = url.searchParams.get("ref") || undefined;
    let ref: string | undefined = undefined;

    if (conversationId) {
      const convo = await Conversation.findOne({
        _id: conversationId,
        userId: session.user.id,
      }).select("supabase");
      ref = (convo?.supabase?.ref || undefined) as string | undefined;
    } else if (refParam) {
      const convo = await Conversation.findOne({
        userId: session.user.id,
        "supabase.ref": refParam,
      }).select("supabase");
      ref = (convo?.supabase?.ref || undefined) as string | undefined;
    }

    if (!ref) {
      return new Response(
        JSON.stringify({ success: false, error: "Project not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const tables = await fetchTablesFromSupabase(ref, session.user.id);


    const normalizedTables = Array.isArray(tables)
      ? tables.map((r: any) => ({
          schema: r.table_schema || r.schema || "public",
          name: r.table_name || r.name,
        }))
      : [];

    return new Response(JSON.stringify({ success: true, ref, tables: normalizedTables }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.log('[API Tables] Error:', e?.message, e?.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: e?.message || "Failed to fetch tables",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}


