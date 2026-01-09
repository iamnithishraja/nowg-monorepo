import { useState } from "react";
import { useFileDragAndDrop } from "./useFileDragAndDrop";

interface UseFileHandlingProps {
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
}

export function useFileHandling({
  uploadedFiles,
  setUploadedFiles,
}: UseFileHandlingProps) {
  const [imageDataList, setImageDataList] = useState<string[]>([]);

  const handleFilesAdded = async (newFiles: File[]) => {
    // Generate image data URLs for new files
    const newImageDataUrls: string[] = [];
    // Prevent browser's default drag and drop behavior
    for (const file of newFiles) {
      if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        newImageDataUrls.push(dataUrl);
      } else {
        newImageDataUrls.push("");
      }
    }

    // Update files and image data
    const updatedFiles = [...uploadedFiles, ...newFiles];
    const updatedImageDataList = [...imageDataList, ...newImageDataUrls];

    setUploadedFiles(updatedFiles);
    setImageDataList(updatedImageDataList);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    const newImageDataList = imageDataList.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    setImageDataList(newImageDataList);
  };

  const { isDragging, dragHandlers } = useFileDragAndDrop({
    onFilesAdded: handleFilesAdded,
    uploadedFiles,
  });

  const handleFileSelect = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,text/*,application/pdf,application/json";
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const fileList = Array.from(files);
        await handleFilesAdded(fileList);
      }
    };
    input.click();
  };

  return {
    imageDataList,
    isDragging,
    dragHandlers,
    handleFileSelect,
    handleRemoveFile,
  };
}
