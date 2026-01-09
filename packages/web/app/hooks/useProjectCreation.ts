import { useState } from "react";
import { useNavigate } from "react-router";
import type { DbProvider } from "../components/DatabaseConnectionDialog";
import type { DesignScheme } from "../types/design-scheme";

interface CreateProjectParams {
  organizationId: string;
  projectAdminId: string;
  projectTitle: string;
  prompt: string;
  model: string;
  files: File[];
  selectedDbProvider: DbProvider | null;
  designScheme: DesignScheme | undefined;
  handleConnectSupabase: () => void;
}

export function useProjectCreation() {
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const navigate = useNavigate();

  const createProject = async ({
    organizationId,
    projectAdminId,
    projectTitle,
    prompt,
    model,
    files,
    selectedDbProvider,
    designScheme,
    handleConnectSupabase,
  }: CreateProjectParams): Promise<void> => {
    if (!projectAdminId || !organizationId || !prompt.trim()) {
      alert("Please select a project admin and organization");
      return;
    }

    setIsCreatingProject(true);

    try {
      const clientRequestId =
        (window.crypto && "randomUUID" in window.crypto
          ? (window.crypto as any).randomUUID()
          : Math.random().toString(36).slice(2)) +
        "-" +
        Date.now();

      const uploadedFilesData = await Promise.all(
        files.map(async (file) => {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });

          return {
            name: file.name,
            type: file.type,
            size: file.size,
            base64Data,
          };
        })
      );

      // Create project with the provided title
      const projectResponse = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectTitle,
          description: prompt,
          organizationId,
          projectAdminId,
        }),
      });

      if (!projectResponse.ok) {
        const errorData = await projectResponse.json().catch(() => ({}));
        alert(
          errorData.message || "Failed to create project. Please try again."
        );
        return;
      }

      const projectData = await projectResponse.json();
      const projectId = projectData.id;

      // Wait a bit for the conversation to be created by the backend
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Fetch the conversation created for this project using organization-conversations API
      let conversationId: string | null = null;

      // Try fetching from organization conversations
      try {
        const orgConvoResponse = await fetch("/api/organization-conversations", {
          credentials: "include",
        });

        if (orgConvoResponse.ok) {
          const orgConvoData = await orgConvoResponse.json();
          const matchingConversation = orgConvoData.conversations?.find(
            (conv: any) => conv.project?.id === projectId
          );
          if (matchingConversation) {
            conversationId = matchingConversation.id;
          }
        }
      } catch (error) {
        console.error("Error fetching organization conversations:", error);
      }

      // If still not found, try querying all conversations and filtering
      if (!conversationId) {
        try {
          const allConvoResponse = await fetch("/api/conversations", {
            credentials: "include",
          });

          if (allConvoResponse.ok) {
            const allConvoData = await allConvoResponse.json();
            const matchingConversation = allConvoData.conversations?.find(
              (conv: any) => conv.adminProjectId === projectId
            );
            if (matchingConversation) {
              conversationId = matchingConversation.id;
            }
          }
        } catch (error) {
          console.error("Error fetching all conversations:", error);
        }
      }

      if (!conversationId) {
        alert("Project created but conversation not found. Please try again.");
        return;
      }

      // Add the initial message to the conversation
      if (prompt) {
        try {
          const messageResponse = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "addMessage",
              conversationId,
              message: prompt,
              clientRequestId,
              uploadedFiles: uploadedFilesData,
            }),
          });

          if (!messageResponse.ok) {
            console.error("Failed to add initial message to conversation");
            // Continue anyway - the workspace will handle it
          } else {
            // Update conversation title to match project title
            try {
              await fetch("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "updateTitle",
                  conversationId,
                  title: projectTitle,
                }),
              });
            } catch (titleError) {
              console.error("Error updating conversation title:", titleError);
              // Continue anyway - project is created
            }
          }
        } catch (error) {
          console.error("Error adding initial message:", error);
          // Continue anyway - the workspace will handle it
        }
      }

      // Handle database provisioning if needed
      if (selectedDbProvider) {
        try {
          const endpoint =
            selectedDbProvider === "neon"
              ? "/api/neon/provision"
              : "/api/supabase/provision";

          const provisionResponse = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, enable: true }),
          });

          if (!provisionResponse.ok) {
            const errorData = await provisionResponse.json().catch(() => ({}));
            console.error(
              `${selectedDbProvider} provision failed:`,
              errorData
            );
            if (selectedDbProvider === "supabase") {
              handleConnectSupabase();
            }
          }
        } catch (e) {
          console.error(`${selectedDbProvider} provision failed`, e);
        }
      }

      // Navigate to workspace
      navigate(`/workspace?conversationId=${conversationId}`, {
        state: {
          initialPrompt: prompt,
          model,
          hasUploadedFiles: files.length > 0,
          designScheme: designScheme,
        },
      });
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
    } finally {
      setIsCreatingProject(false);
    }
  };

  return {
    createProject,
    isCreatingProject,
  };
}

