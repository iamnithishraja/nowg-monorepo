import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { NotificationService } from "~/lib/notificationService";

const notificationService = new NotificationService();

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated user
 */
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

    const url = new URL(request.url);
    const countOnly = url.searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await notificationService.getUnreadCount(session.user.id);
      return new Response(JSON.stringify({ unreadCount: count }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const notifications = await notificationService.getForUser(session.user.id);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return new Response(
      JSON.stringify({ notifications, unreadCount }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Notifications API (GET) error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * POST /api/notifications
 * Actions: markRead, markAllRead, delete, clearAll
 */
export async function action({ request }: ActionFunctionArgs) {
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
    const body = await request.json();
    const { action: actionType, notificationId } = body;

    switch (actionType) {
      case "create": {
        const { type, title, message, conversationId, metadata } = body;
        if (!type || !title || !message) {
          return new Response(
            JSON.stringify({ error: "type, title, and message are required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        const notification = await notificationService.create({
          userId,
          conversationId,
          type,
          title,
          message,
          metadata,
        });
        return new Response(JSON.stringify({ success: true, notification }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      case "markRead":
        if (!notificationId) {
          return new Response(
            JSON.stringify({ error: "notificationId is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        await notificationService.markAsRead(notificationId, userId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "markAllRead":
        await notificationService.markAllAsRead(userId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "delete":
        if (!notificationId) {
          return new Response(
            JSON.stringify({ error: "notificationId is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        await notificationService.delete(notificationId, userId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "clearAll":
        await notificationService.clearAll(userId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Notifications API (POST) error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
