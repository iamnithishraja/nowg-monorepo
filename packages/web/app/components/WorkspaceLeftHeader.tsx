import { useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  CaretDown,
  SidebarSimple,
  SquaresFour,
  CreditCard,
  Gear,
} from "@phosphor-icons/react";
import crop from "~/assets/crop.png";
import { CaretLeft, GasPump, GearSix, Plus } from "phosphor-react";
import { ChatSwitcher } from "./ChatSwitcher";

interface WorkspaceLeftHeaderProps {
  chatTitle?: string;
  conversationId?: string;
  onCreateNewChat?: () => void;
  currentChatId?: string | null;
  onChatChange?: (chatId: string | null) => void;
}

export function WorkspaceLeftHeader({ 
  chatTitle, 
  conversationId,
  onCreateNewChat,
  currentChatId,
  onChatChange
}: WorkspaceLeftHeaderProps) {
  const navigate = useNavigate();

  const toggleSidebar = () => {
    window.dispatchEvent(new CustomEvent("toggleProjectSidebar"));
  };

  return (
    <div className="h-12 shrink-0 flex items-center justify-between px-3 bg-transparent relative">
      <div className="flex items-center gap-2">
        {/* Logo Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2/50 transition-colors group relative z-10">
              <div className="w-6 h-6 rounded-md overflow-hidden">
                <img
                  src={crop}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-sm font-medium text-primary max-w-[100px] truncate">
                {chatTitle || "Workspace"}
              </span>
              <CaretDown className="w-3.5 h-3.5 text-tertiary group-hover:text-primary transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 bg-surface-1 border-border/50"
          >
            <DropdownMenuItem
              onClick={() => navigate("/home")}
              className="gap-2 cursor-pointer"
            >
              <CaretLeft className="w-4 h-4" />
              Go to Dashboard
            </DropdownMenuItem>
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

        {/* Chat Switcher */}
        {conversationId && onChatChange && (
          <ChatSwitcher
            conversationId={conversationId}
            currentChatId={currentChatId}
            onChatChange={onChatChange}
          />
        )}
      </div>

      {/* Right side buttons */}
      <div className="flex items-center gap-2">
        {/* New Chat Button */}
        {conversationId && onCreateNewChat && (
          <button
            onClick={onCreateNewChat}
            className="p-2 rounded-lg text-tertiary hover:text-primary hover:bg-surface-2/50 transition-colors relative z-10"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
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
