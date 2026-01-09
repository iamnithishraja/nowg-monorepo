import { useState } from "react";

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64Data: string;
  uploadedAt: string | Date;
}

interface MessageAttachmentsProps {
  files?: FileAttachment[];
}

export function MessageAttachments({ files }: MessageAttachmentsProps) {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((file) => (
        <FileAttachmentItem key={file.id} file={file} />
      ))}
    </div>
  );
}

function FileAttachmentItem({ file }: { file: FileAttachment }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDownload = () => {
    // Create a download link
    const link = document.createElement("a");
    link.href = file.base64Data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // For images, show thumbnail
  if (file.type.startsWith("image/")) {
    return (
      <div className="relative group">
        <div
          className="flex items-center gap-2 px-3 py-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg cursor-pointer hover:bg-bolt-elements-background-depth-3 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 flex-1">
            <img
              src={file.base64Data}
              alt={file.name}
              className="w-10 h-10 object-cover rounded"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm text-bolt-elements-textPrimary truncate">
                {file.name}
              </span>
              <span className="text-xs text-bolt-elements-textSecondary">
                {formatFileSize(file.size)}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="p-1.5 hover:bg-bolt-elements-background-depth-4 rounded transition-colors"
            title="Download"
          >
            <svg
              className="w-4 h-4 text-bolt-elements-textSecondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
            onClick={() => setIsExpanded(false)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={file.base64Data}
                alt={file.name}
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={() => setIsExpanded(false)}
                className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-colors"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // For other files, show icon and name
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg cursor-pointer hover:bg-bolt-elements-background-depth-3 transition-colors"
      onClick={handleDownload}
    >
      <svg
        className="w-5 h-5 text-bolt-elements-textSecondary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-bolt-elements-textPrimary truncate">
          {file.name}
        </span>
        <span className="text-xs text-bolt-elements-textSecondary">
          {formatFileSize(file.size)}
        </span>
      </div>
    </div>
  );
}

