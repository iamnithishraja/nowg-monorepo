import { useState, useEffect } from "react";
import { ChevronDown, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface Chat {
  id: number;
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
  }, [conversationId]);

  const currentChat = currentChatId
    ? chats.find((c) => c.id.toString() === currentChatId)
    : null;
  const currentTitle = currentChat?.title || "Main Chat";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2/50 transition-colors text-sm font-medium text-primary">
          <MessageSquare className="w-4 h-4" />
          <span className="max-w-[120px] truncate">{currentTitle}</span>
          <ChevronDown className="w-3.5 h-3.5 text-tertiary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 bg-surface-1 border-border/50 max-h-[300px] overflow-y-auto"
      >
        {isLoading ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Loading chats...
          </div>
        ) : chats.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No chats yet
          </div>
        ) : (
          <>
            {/* Main chat option (no chatId) */}
            <DropdownMenuItem
              onClick={() => onChatChange(null)}
              className={`gap-2 cursor-pointer ${
                !currentChatId ? "bg-primary/10" : ""
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <div className="flex flex-col flex-1">
                <span className="text-sm">Main Chat</span>
                <span className="text-xs text-muted-foreground">
                  All messages
                </span>
              </div>
            </DropdownMenuItem>
            {chats.length > 0 && (
              <div className="h-px bg-border/50 my-1" />
            )}
            {/* Individual chats */}
            {chats.map((chat) => (
              <DropdownMenuItem
                key={chat.id}
                onClick={() => onChatChange(chat.id.toString())}
                className={`gap-2 cursor-pointer ${
                  currentChatId === chat.id.toString() ? "bg-primary/10" : ""
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm truncate">{chat.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {chat.messageCount} message{chat.messageCount !== 1 ? "s" : ""}
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

