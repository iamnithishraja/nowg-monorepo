import { useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { CaretDown, SidebarSimple } from "@phosphor-icons/react";
import crop from "~/assets/crop.png";
import { CaretLeft, GasPump, GearSix, Plus, ChatCircle } from "phosphor-react";
import { ChatSwitcher } from "./ChatSwitcher";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface WorkspaceLeftHeaderProps {
  chatTitle?: string;
  conversationId?: string;
  onCreateNewChat?: () => void;
  currentChatId?: string | null;
  onChatChange?: (chatId: string | null) => void;
  isCreatingNewChat?: boolean;
  /** Title of the current chat (for ChatSwitcher when title is updated from first message) */
  currentChatTitle?: string | null;
}

export function WorkspaceLeftHeader({
  chatTitle,
  conversationId,
  onCreateNewChat,
  currentChatId,
  onChatChange,
  isCreatingNewChat = false,
  currentChatTitle,
}: WorkspaceLeftHeaderProps) {
  const navigate = useNavigate();

  const toggleSidebar = () => {
    window.dispatchEvent(new CustomEvent("toggleProjectSidebar"));
  };

  return (
    <div className="h-12 shrink-0 flex items-center justify-between px-3 bg-transparent relative">
      <div className="flex items-center gap-1.5">
        {/* Logo Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2/50 transition-colors group relative z-10">
              <div className="w-5 h-5 rounded-md overflow-hidden">
                <img
                  src={crop}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-sm font-medium text-primary max-w-[100px] truncate">
                {chatTitle || "Workspace"}
              </span>
              <CaretDown className="w-3 h-3 text-tertiary group-hover:text-primary transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 bg-surface-1/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/20"
          >
            <DropdownMenuItem
              onClick={() => navigate("/home")}
              className="gap-2 cursor-pointer"
            >
              <CaretLeft className="w-4 h-4" />
              Go to Dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/30" />
            <DropdownMenuItem
              onClick={() => navigate("/recharge")}
              className="gap-2 cursor-pointer"
            >
              <GasPump className="w-4 h-4" />
              Request Credit Refill
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/profile")}
              className="gap-2 cursor-pointer"
            >
              <GearSix className="w-4 h-4" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Divider */}
        {conversationId && onChatChange && (
          <div className="w-px h-4 bg-border/30" />
        )}

        {/* Chat Switcher */}
        {conversationId && onChatChange && (
          <ChatSwitcher
            conversationId={conversationId}
            currentChatId={currentChatId}
            onChatChange={onChatChange}
            currentChatTitle={currentChatTitle}
          />
        )}
      </div>

      {/* Right side buttons */}
      <div className="flex items-center gap-1">
        {/* New Chat Button */}
        {conversationId && onCreateNewChat && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCreateNewChat}
                disabled={isCreatingNewChat}
                className={cn(
                  "p-1.5 rounded-md transition-all relative z-10 border",
                  isCreatingNewChat
                    ? "text-muted-foreground/50 bg-purple-500/5 border-purple-500/10 cursor-not-allowed"
                    : "text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 border-transparent hover:border-purple-500/20"
                )}
              >
                {isCreatingNewChat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" weight="bold" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isCreatingNewChat ? "Creating chat..." : "New side chat"}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Sidebar Toggle */}
                    <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg text-tertiary hover:text-primary hover:bg-surface-2/50 transition-colors relative z-10"
title="Toggle sidebar"
            >
              <SidebarSimple className="w-5 h-5" />
            </button>
                </div>
    </div>
  );
}
