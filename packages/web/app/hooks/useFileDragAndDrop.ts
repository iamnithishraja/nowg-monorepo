import { useState } from "react";

interface UseFileDragAndDropProps {
  onFilesAdded: (files: File[]) => void;
  uploadedFiles?: File[];
}

export function useFileDragAndDrop({
  onFilesAdded,
  uploadedFiles = [],
}: UseFileDragAndDropProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Explicitly set dropEffect to 'copy' to indicate we'll copy the files
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Explicitly set dropEffect to 'copy' to indicate we'll copy the files
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const existingFiles = uploadedFiles || [];

    // Filter out duplicates
    const uniqueNewFiles = droppedFiles.filter(
      (newFile) =>
        !existingFiles.some(
          (existingFile) =>
            existingFile.name === newFile.name &&
            existingFile.size === newFile.size
        )
    );

    if (uniqueNewFiles.length > 0) {
      onFilesAdded(uniqueNewFiles);
    }
  };

  return {
    isDragging,
    dragHandlers: {
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
