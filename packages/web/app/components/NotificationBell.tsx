import {
  Bell,
  ChatTeardropDots,
  Check,
  GithubLogo,
  PencilSimple,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "../lib/utils";

interface NotificationBellProps {
  /** Extra class names for the outer wrapper */
  className?: string;
  /** Bell icon size (w/h class) – defaults to "w-5 h-5" */
  iconSize?: string;
  /** Tailwind button classes for the trigger */
  buttonClassName?: string;
}

export function NotificationBell({
  className,
  iconSize = "w-5 h-5",
  buttonClassName = "flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/[0.04] active:bg-white/[0.08] text-white/40 hover:text-white transition-colors touch-manipulation cursor-pointer",
}: NotificationBellProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Data fetching ----
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll every 30 s
  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchNotifications]);

  // Click-outside close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        showPanel &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setShowPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPanel]);

  // ---- Actions ----
  const markRead = useCallback(async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  const deleteOne = useCallback(async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", notificationId: id }),
      });
      setNotifications((prev) => {
        const removed = prev.find((n) => n.id === id);
        if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));
        return prev.filter((n) => n.id !== id);
      });
    } catch {}
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearAll" }),
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  }, []);

  // ---- Helpers ----
  const typeIcon = (type: string) => {
    switch (type) {
      case "project_created":
        return <ChatTeardropDots className="w-4 h-4 text-purple-400" />;
      case "version_reverted":
        return <SpinnerGap className="w-4 h-4 text-blue-400" />;
      case "canvas_edit":
        return <PencilSimple className="w-4 h-4 text-green-400" />;
      case "github_push":
        return <GithubLogo className="w-4 h-4 text-orange-400" />;
      default:
        return <Bell className="w-4 h-4 text-white/50" />;
    }
  };

  const relativeTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={cn("relative", className)}>
      {/* Trigger */}
      <button
        ref={btnRef}
        onClick={() => {
          setShowPanel((v) => !v);
          if (!showPanel) fetchNotifications();
        }}
        className={cn(buttonClassName, "relative")}
        title="Notifications"
      >
        <Bell className={iconSize} weight="bold" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-purple-500 rounded-full animate-pulse ring-2 ring-[#0c0c0c]" />
        )}
      </button>

      {/* Panel */}
      {showPanel && (
        <div
          ref={panelRef}
          className="absolute top-full right-0 mt-2 w-80 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden"
          style={{
            boxShadow:
              "0 0 40px rgba(139,92,246,0.15), 0 20px 40px rgba(0,0,0,0.6)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors text-[10px] font-medium flex items-center gap-1"
                  title="Mark all as read"
                >
                  <Check className="w-3 h-3" />
                  All read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Clear all"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setShowPanel(false)}
                className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <SpinnerGap className="w-5 h-5 animate-spin text-purple-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-sm text-white/30 text-center">
                  No notifications yet
                </p>
                <p className="text-xs text-white/20 text-center mt-1">
                  Activity from your projects will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 group hover:bg-white/[0.03] transition-colors cursor-pointer",
                      !notif.read && "bg-purple-500/[0.04]"
                    )}
                    onClick={() => {
                      if (!notif.read) markRead(notif.id);
                      if (notif.conversationId) {
                        navigate(
                          `/workspace?conversationId=${notif.conversationId}`
                        );
                        setShowPanel(false);
                      }
                    }}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        !notif.read ? "bg-purple-500/15" : "bg-white/5"
                      )}
                    >
                      {typeIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p
                          className={cn(
                            "text-xs font-semibold leading-tight",
                            notif.read ? "text-white/60" : "text-white"
                          )}
                        >
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-white/25 mt-1">
                        {relativeTime(notif.createdAt)}
                      </p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteOne(notif.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-all shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white/[0.06] text-center">
              <p className="text-[10px] text-white/20">
                {notifications.length} notification
                {notifications.length !== 1 ? "s" : ""} total
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
