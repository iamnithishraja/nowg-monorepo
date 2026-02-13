import { Code, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface DownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadCodebase: () => void;
  onDownloadMessages: () => void;
  hasCodebase: boolean;
}

export function DownloadModal({
  open,
  onOpenChange,
  onDownloadCodebase,
  onDownloadMessages,
  hasCodebase,
}: DownloadModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Options</DialogTitle>
          <DialogDescription>
            Choose what you would like to download
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          {hasCodebase && (
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => {
                onDownloadCodebase();
                onOpenChange(false);
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <Code className="w-5 h-5" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">Download Codebase</span>
                  <span className="text-xs text-muted-foreground">
                    Download all project files as a ZIP archive
                  </span>
                </div>
              </div>
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={() => {
              onDownloadMessages();
              onOpenChange(false);
            }}
          >
            <div className="flex items-center gap-3 w-full">
              <MessageSquare className="w-5 h-5" />
              <div className="flex flex-col items-start">
                <span className="font-medium">Download Messages</span>
                <span className="text-xs text-muted-foreground">
                  Download chat history as an HTML file
                </span>
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
