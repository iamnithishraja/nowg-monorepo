import { Users, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

interface AddTeammateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onInvite: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function AddTeammateDialog({
  open,
  onOpenChange,
  email,
  onEmailChange,
  onInvite,
  isLoading = false,
  error,
}: AddTeammateDialogProps) {
  const [message, setMessage] = useState("");

  const handleClose = () => {
    onEmailChange("");
    setMessage("");
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && email.trim() && !isLoading) {
      e.preventDefault();
      onInvite();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-md p-0 bg-[#0c0c0c] border-[#27272a] overflow-hidden"
        showCloseButton={false}
      >
        {/* Header with Icon */}
        <div className="flex flex-col items-center pt-8 pb-6">
          <div className="w-16 h-16 rounded-full bg-[#1b1b1b] border border-[#27272a] flex items-center justify-center mb-4 relative">
            <Users className="h-7 w-7 text-white" strokeWidth={1.5} />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#4208FF] to-[#FF76B9] flex items-center justify-center border-2 border-[#0c0c0c]">
              <Plus className="h-3 w-3 text-white" strokeWidth={3} />
            </div>
          </div>
          <DialogHeader className="text-center space-y-1">
            <DialogTitle className="text-[20px] font-semibold text-[#f4f4f5] tracking-[-0.4px]">
              Add Teammate
            </DialogTitle>
            <p className="text-[14px] text-[#a4a4a7] tracking-[-0.28px]">
              Type or paste in emails below, separated by commas.
            </p>
          </DialogHeader>
        </div>

        {/* Form Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Email Input */}
          <div className="space-y-2">
            <Input
              placeholder="Search Emails"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-12 bg-[#1b1b1b] border-[#27272a] text-[#f4f4f5] placeholder:text-[#727279] text-[14px] rounded-lg focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg">
              <p className="text-[13px] text-[#ef4444]">{error}</p>
            </div>
          )}

          {/* Message Field */}
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#f4f4f5] tracking-[-0.26px]">
              Message
            </Label>
            <Textarea
              placeholder="Add a note to your invite..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="bg-[#1b1b1b] border-[#27272a] text-[#f4f4f5] placeholder:text-[#727279] text-[14px] rounded-lg focus:border-[#7b4cff] focus:ring-[#7b4cff]/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={onInvite}
              disabled={isLoading || !email.trim()}
              style={{
                background: "linear-gradient(89.84deg, #4208FF 5.63%, #611BF3 49.1%, #D30DFF 88.1%, #FF76B9 99.84%)",
              }}
              className="w-full h-12 text-white font-medium text-[15px] rounded-lg shadow-lg shadow-[#4208FF]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            >
              {isLoading ? "Sending..." : "Send Invite"}
            </Button>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="w-full text-center text-[14px] font-medium text-white hover:text-[#a4a4a7] transition-colors py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
