import { useState, useEffect } from "react";
import { ChevronDown, MessageSquare, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { cn } from "../lib/utils";

interface Chat {
  id: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatSwitcherProps {
  conversationId: string;
  currentChatId?: string | null;
  onChatChange: (chatId: string | null) => void;
}

export function ChatSwitcher({
  conversationId,
  currentChatId,
  onChatChange,
}: ChatSwitcherProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadChats = async () => {
      if (!conversationId) return;
      try {
        setIsLoading(true);
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "getChats",
            conversationId,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setChats(data.chats || []);
        }
      } catch (error) {
        console.error("Error loading chats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChats();
  }, [conversationId, currentChatId]);

  const currentChat = currentChatId
    ? chats.find((c) => c.id === currentChatId)
    : null;
  const currentTitle = currentChat?.title || "Main";

  if (!isLoading && chats.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-surface-2/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border/30">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="max-w-[80px] truncate">{currentTitle}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56 bg-surface-1/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/20"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1.5">
          Switch Chat
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/30" />

        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            {/* Main chat option (no chatId) */}
            <DropdownMenuItem
              onClick={() => onChatChange(null)}
              className={cn(
                "gap-2 cursor-pointer rounded-md mx-1 my-0.5",
                !currentChatId && "bg-purple-500/10 text-purple-400"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-md flex items-center justify-center shrink-0",
                  !currentChatId
                    ? "bg-purple-500/20 border border-purple-500/30"
                    : "bg-surface-2 border border-border/30"
                )}
              >
                {!currentChatId ? (
                  <Check className="w-3 h-3 text-purple-400" />
                ) : (
                  <MessageSquare className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium">Main Conversation</span>
                <span className="text-[10px] text-muted-foreground">
                  Original project chat
                </span>
              </div>
            </DropdownMenuItem>

            {chats.length > 0 && (
              <DropdownMenuSeparator className="bg-border/30 my-1" />
            )}

            {/* Side chats */}
            {chats.map((chat) => (
              <DropdownMenuItem
                key={chat.id}
                onClick={() => onChatChange(chat.id)}
                className={cn(
                  "gap-2 cursor-pointer rounded-md mx-1 my-0.5",
                  currentChatId === chat.id &&
                    "bg-purple-500/10 text-purple-400"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-md flex items-center justify-center shrink-0",
                    currentChatId === chat.id
                      ? "bg-purple-500/20 border border-purple-500/30"
                      : "bg-surface-2 border border-border/30"
                  )}
                >
                  {currentChatId === chat.id ? (
                    <Check className="w-3 h-3 text-purple-400" />
                  ) : (
                    <MessageSquare className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">
                    {chat.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {chat.messageCount} message
                    {chat.messageCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
