import { Conversation } from "@nowgai/shared/models";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "../lib/auth";
import {
    createRowInSupabase,
    deleteRowFromSupabase,
    fetchRowsFromSupabase,
    updateRowInSupabase,
} from "../lib/supabaseManager";

/**
 * GET /api/supabase/rows?conversationId=...&schema=public&table=your_table&limit=50&offset=0
 * Also supports ?ref=... instead of conversationId (validated against user's conversations).
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
    const schema = (url.searchParams.get("schema") || "public").trim();
    const table = (url.searchParams.get("table") || "").trim();
    const limit = Math.max(
      1,
      Math.min(200, Number(url.searchParams.get("limit") || "50"))
    );
    const offset = Math.max(0, Number(url.searchParams.get("offset") || "0"));

    if (!table) {
      return new Response(
        JSON.stringify({ success: false, error: "table is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

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

    const result = await fetchRowsFromSupabase(
      ref,
      schema,
      table,
      limit,
      offset,
      session.user.id
    );

    return new Response(
      JSON.stringify({
        success: true,
        ref,
        schema,
        table,
        limit,
        offset,
        total: result.total,
        rows: result.rows,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.log("[API Rows] Error:", e?.message, e?.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: e?.message || "Failed to fetch rows",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * POST /api/supabase/rows - Create a new row
 * PUT /api/supabase/rows - Update an existing row
 * DELETE /api/supabase/rows - Delete a row
 */
export async function action({ request }: ActionFunctionArgs) {
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
    const method = request.method;
    const body = await request.json();
    const {
      conversationId,
      ref: refParam,
      schema = "public",
      table,
      data,
      primaryKey,
      primaryValue,
    } = body;

    if (!table) {
      return new Response(
        JSON.stringify({ success: false, error: "table is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get project ref
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

    if (method === "POST") {
      // Create row
      if (!data || typeof data !== "object") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "data is required for creating a row",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const result = await createRowInSupabase(
        ref,
        schema,
        table,
        data,
        session.user.id
      );
      return new Response(JSON.stringify({ success: true, row: result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "PUT" || method === "PATCH") {
      // Update row
      if (!data || typeof data !== "object") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "data is required for updating a row",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (!primaryKey || primaryValue === undefined) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "primaryKey and primaryValue are required for updating a row",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const result = await updateRowInSupabase(
        ref,
        schema,
        table,
        primaryKey,
        primaryValue,
        data,
        session.user.id
      );
      return new Response(JSON.stringify({ success: true, row: result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (method === "DELETE") {
      // Delete row
      if (!primaryKey || primaryValue === undefined) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "primaryKey and primaryValue are required for deleting a row",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      await deleteRowFromSupabase(
        ref,
        schema,
        table,
        primaryKey,
        primaryValue,
        session.user.id
      );
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (e: any) {
    console.log("[API Rows Action] Error:", e?.message, e?.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: e?.message || "Failed to perform operation",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
