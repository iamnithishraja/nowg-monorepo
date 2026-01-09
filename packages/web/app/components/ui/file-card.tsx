import { X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { FileIcon } from "./file-icon";

interface FileCardProps {
  file: File;
  imageUrl?: string;
  onRemove: () => void;
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function FileCard({ file, imageUrl, onRemove }: FileCardProps) {
  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative group cursor-pointer">
            <div className="relative flex rounded-lg overflow-hidden shadow-md transition-all duration-200 group-hover:shadow-lg group-hover:shadow-primary/5">
              {imageUrl && file.type.startsWith("image/") ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt={file.name}
                    className="w-20 h-20 object-cover rounded-lg border border-white/[0.08] transition-all duration-200 group-hover:border-white/[0.12]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 rounded-lg transition-all duration-200" />
                </div>
              ) : (
                <div className="w-20 h-20 flex items-center justify-center bg-white/[0.04] border border-white/[0.08] rounded-lg transition-all duration-200 group-hover:border-white/[0.12] group-hover:bg-white/[0.08]">
                  <FileIcon file={file} />
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="bg-background/95 backdrop-blur-sm border border-border/60 shadow-xl"
        >
          <div className="text-center">
            <div className="font-medium text-sm">{file.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatFileSize(file.size)}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>

      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 rounded-full w-5 h-5 flex items-center justify-center z-30 bg-background/95 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground border border-border/50 shadow-lg hover:shadow-xl transition-all duration-200 group"
        type="button"
      >
        <X className="w-3 h-3 transition-transform duration-200 group-hover:scale-110" />
      </button>
    </div>
  );
}
