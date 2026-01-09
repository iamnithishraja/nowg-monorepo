import { FileText, Image } from "lucide-react";

interface FileIconProps {
  file: File;
}

export function FileIcon({ file }: FileIconProps) {
  if (file.type.startsWith("image/")) {
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
        <Image className="w-4 h-4 text-blue-500" />
      </div>
    );
  }

  if (file.type.includes("pdf")) {
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
        <FileText className="w-4 h-4 text-red-500" />
      </div>
    );
  }

  if (file.type.includes("text")) {
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-gray-500/20 to-slate-500/20 rounded-lg flex items-center justify-center">
        <FileText className="w-4 h-4 text-gray-500" />
      </div>
    );
  }

  if (file.type.includes("json")) {
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center">
        <FileText className="w-4 h-4 text-green-500" />
      </div>
    );
  }

  if (
    file.type.includes("code") ||
    file.name.endsWith(".js") ||
    file.name.endsWith(".ts") ||
    file.name.endsWith(".jsx") ||
    file.name.endsWith(".tsx")
  ) {
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center">
        <FileText className="w-4 h-4 text-purple-500" />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 bg-gradient-to-br from-slate-500/20 to-zinc-500/20 rounded-lg flex items-center justify-center">
      <FileText className="w-4 h-4 text-slate-500" />
    </div>
  );
}
