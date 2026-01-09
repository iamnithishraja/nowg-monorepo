import React, { useState, useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { FileCard } from "./ui/file-card";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface FileUploadProps {
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  maxFileSize?: number;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  onFileUpload?: (file: File) => void;
  onFileRemove?: (index: number) => void;
  className?: string;
  uploadIcon?: string;
  removeIcon?: string;
  fileIcon?: string;
}

export interface FilePreviewProps {
  files: File[];
  onRemove: (index: number) => void;
  maxPreviewSize?: number;
  className?: string;
  removeIcon?: string;
  fileIcon?: string;
  imageDataList?: string[];
}

// ============================================================================
// FILE UPLOAD HOOK
// ============================================================================

export const useFileUpload = ({
  uploadedFiles,
  setUploadedFiles,
  maxFileSize = 10 * 1024 * 1024,
  acceptedFileTypes = [
    "image/*",
    "text/*",
    "application/pdf",
    "application/json",
  ],
  maxFiles = 5,
  onFileUpload,
  onFileRemove,
}: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageDataList, setImageDataList] = useState<string[]>([]);

  // Use refs to get current values
  const uploadedFilesRef = useRef(uploadedFiles);

  // Update refs when props change
  uploadedFilesRef.current = uploadedFiles;

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File ${file.name} is too large. Maximum size is ${Math.round(
        maxFileSize / 1024 / 1024
      )}MB`;
    }

    const isValidType = acceptedFileTypes.some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isValidType) {
      return `File type ${file.type} is not supported`;
    }

    if (uploadedFiles.length >= maxFiles) {
      return `Maximum ${maxFiles} files allowed`;
    }

    return null;
  };

  const processFile = (file: File): Promise<void> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newFiles = [...uploadedFiles, file];
          const newImageDataList = [
            ...imageDataList,
            e.target?.result as string,
          ];
          setUploadedFiles(newFiles);
          setImageDataList(newImageDataList);
          onFileUpload?.(file);
          resolve();
        };
        reader.readAsDataURL(file);
      } else {
        const newFiles = [...uploadedFiles, file];
        setUploadedFiles(newFiles);
        onFileUpload?.(file);
        resolve();
      }
    });
  };

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      setUploadError(null);

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          setUploadError(error);
          continue;
        }

        try {
          await processFile(file);
        } catch (error) {
          setUploadError(`Failed to process ${file.name}`);
          console.error("File processing error:", error);
        }
      }
    },
    [uploadedFiles, maxFileSize, acceptedFileTypes, maxFiles]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files);
      }
    },
    [handleFileUpload]
  );

  const handleClickUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = acceptedFileTypes.join(",");

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        handleFileUpload(files);
      }
    };

    input.click();
  }, [handleFileUpload, acceptedFileTypes]);

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = uploadedFiles.filter((_, i) => i !== index);
      const newImageDataList = imageDataList.filter((_, i) => i !== index);
      setUploadedFiles(newFiles);
      setImageDataList(newImageDataList);
      onFileRemove?.(index);
    },
    [uploadedFiles, imageDataList, setUploadedFiles, onFileRemove]
  );

  return {
    isDragging,
    uploadError,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleClickUpload,
    removeFile,
    handleFileUpload,
    imageDataList,
  };
};

// ============================================================================
// FILE PREVIEW COMPONENT
// ============================================================================

export const FilePreview: React.FC<FilePreviewProps> = ({
  files,
  onRemove,
  maxPreviewSize = 80,
  className = "",
  removeIcon = "✕",
  fileIcon = "📄",
  imageDataList = [],
}) => {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col gap-3 bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] py-4 rounded-xl shadow-lg shadow-black/20 mx-0 mb-3 ${className}`}
    >
      <div className="flex gap-4 px-4 overflow-x-auto scrollbar-none">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${index}`}
            className="flex flex-col items-center gap-2 min-w-0"
          >
            <FileCard
              file={file}
              imageUrl={imageDataList[index]}
              onRemove={() => onRemove(index)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ENHANCED TEXTAREA WITH FILE UPLOAD
// ============================================================================

interface EnhancedTextareaProps extends FileUploadProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  textareaClassName?: string;
  containerClassName?: string;
  acceptedFileTypes?: string[];
}

export const EnhancedTextarea: React.FC<EnhancedTextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder = "Type your message...",
  className = "",
  disabled = false,
  textareaRef,
  textareaClassName = "",
  containerClassName = "",
  uploadIcon = "+",
  acceptedFileTypes = [
    "image/*",
    "text/*",
    "application/pdf",
    "application/json",
  ],
  ...fileUploadProps
}) => {
  const {
    removeFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileUpload,
    isDragging,
    handleClickUpload,
    imageDataList,
  } = useFileUpload({
    ...fileUploadProps,
    acceptedFileTypes,
  });

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items as any) {
      if (item.kind === "file" && item.type && item.type.startsWith("image/")) {
        const f = item.getAsFile?.();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      // use the hook's upload pipeline for validation
      void handleFileUpload(imageFiles);
    }
  };

  return (
    <div
      className={`relative ${className} ${containerClassName}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File Preview */}
      <FilePreview
        files={fileUploadProps.uploadedFiles}
        onRemove={removeFile}
        removeIcon={fileUploadProps.removeIcon}
        fileIcon={fileUploadProps.fileIcon}
        imageDataList={imageDataList}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 border-2 border-dashed border-primary/60 rounded-lg bg-background/40 pointer-events-none" />
      )}

      {/* Textarea Container */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-3 pr-3 pt-4 pb-4 outline-none resize-none bg-transparent text-sm transition-all duration-300 border rounded-lg ${
            isDragging ? "border-primary border-2" : "border-border"
          } ${textareaClassName}`}
        />

        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center pointer-events-none z-10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="w-8 h-8 animate-bounce" />
              <div className="text-primary font-medium text-sm">
                Drop files here to upload
              </div>
              <div className="text-primary/70 text-xs">
                {acceptedFileTypes?.join(", ").replace(/\*/g, "")}
              </div>
            </div>
          </div>
        )}

        {/* Upload Button - Only show if not using external bottom bar */}
        {!textareaClassName?.includes("pb-12") && (
          <button
            onClick={handleClickUpload}
            disabled={disabled}
            className="absolute left-2 bottom-2 h-8 w-8 rounded-md p-0 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 hover:border-border transition-all duration-200 group shadow-sm z-20 flex items-center justify-center"
            title="Upload files (drag & drop or click)"
          >
            <Upload className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// COMPLETE CHAT INPUT WITH FILE UPLOAD
// ============================================================================

interface ChatInputWithUploadProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isStreaming?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  maxFileSize?: number;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  className?: string;
  textareaClassName?: string;
  uploadIcon?: string;
  removeIcon?: string;
  fileIcon?: string;
}

export const ChatInputWithUpload: React.FC<ChatInputWithUploadProps> = ({
  value,
  onChange,
  onKeyDown,
  onSend,
  placeholder = "Type your message...",
  disabled = false,
  isStreaming = false,
  textareaRef,
  uploadedFiles,
  setUploadedFiles,
  maxFileSize = 10 * 1024 * 1024,
  acceptedFileTypes = ["text/*", "application/pdf", "application/json"],
  maxFiles = 5,
  className = "",
  textareaClassName = "",
  uploadIcon = "+",
  removeIcon = "✕",
  fileIcon = "📄",
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isStreaming && onSend) {
        onSend();
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`w-full ${className}`}>
      <EnhancedTextarea
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        textareaRef={textareaRef}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        maxFileSize={maxFileSize}
        acceptedFileTypes={acceptedFileTypes}
        maxFiles={maxFiles}
        textareaClassName={textareaClassName}
        uploadIcon={uploadIcon}
        removeIcon={removeIcon}
        fileIcon={fileIcon}
      />
    </div>
  );
};
