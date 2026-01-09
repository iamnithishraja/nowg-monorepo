import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { FigmaConnectPanel } from "./FigmaConnectPanel";
import { useFigmaAuth } from "../hooks/useFigmaAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { OPENROUTER_MODELS } from "../consts/models";

interface FigmaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Kept for backward compatibility with the previous modal API.
   * (Unused now — this modal is OAuth-only.)
   */
  selectedModel?: string;
}

export default function FigmaImportModal({
  isOpen,
  onClose,
}: FigmaImportModalProps) {
  const navigate = useNavigate();
  const {
    isCheckingToken,
    hasFigmaConnected,
    figmaUser,
    handleConnectFigma,
    handleDisconnectFigma,
  } = useFigmaAuth();

  const [figmaUrl, setFigmaUrl] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !hasFigmaConnected) {
      setFigmaUrl("");
      setBuildError(null);
      setIsBuilding(false);
    }
  }, [hasFigmaConnected, isOpen]);

  const handleBuildLegacy = async () => {
    const url = figmaUrl.trim();
    if (!url) {
      setBuildError("Please paste a Figma file URL.");
      return;
    }

    setIsBuilding(true);
    setBuildError(null);

    try {
      const response = await fetch("/api/figma/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          (errorData as any)?.error || `Request failed (${response.status})`
        );
      }

      const data = await response.json();
      if (!data.success || !data.prompt) {
        throw new Error("Failed to generate design conversion prompt");
      }

      const conversationResponse = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "create",
          title: `Figma: ${data.designData?.fileName || "Design"}`,
          model: OPENROUTER_MODELS[0].id,
        }),
      });

      if (!conversationResponse.ok) {
        const errorData = await conversationResponse.json().catch(() => null);
        throw new Error(
          (errorData as any)?.error || "Failed to create conversation"
        );
      }

      const conversationData = await conversationResponse.json();
      const conversationId = conversationData.conversationId;

      onClose();

      const fileName = data.designData?.fileName || "Figma Design";
      const frameCount = data.designData?.frameCount || 0;

      navigate(`/workspace?conversationId=${conversationId}`, {
        state: {
          initialPrompt: data.prompt,
          displayMessage: `Convert my Figma design "${fileName}" (${frameCount} frame${
            frameCount !== 1 ? "s" : ""
          }) to a React application`,
          isSystemPrompt: true, // Flag to indicate this is a system-generated prompt
          model: OPENROUTER_MODELS[0].id,
          figmaDesign: {
            fileName: data.designData?.fileName,
            frameCount: data.designData?.frameCount,
            images: data.designData?.images,
          },
        },
      });
    } catch (error) {
      console.error("Build error:", error);
      setBuildError(
        error instanceof Error ? error.message : "Failed to build from Figma"
      );
    } finally {
      setIsBuilding(false);
    }
  };

  const handleBuild = () => {
    void handleBuildLegacy();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="w-[80vw] max-w-[720px] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl">Figma Import</DialogTitle>
          <DialogDescription>
            Paste a Figma link and generate a React app from your Figma designs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="shrink-0">
            <FigmaConnectPanel
              hasFigmaConnected={hasFigmaConnected}
              isCheckingToken={isCheckingToken}
              figmaEmail={figmaUser?.email}
              onConnect={handleConnectFigma}
              onDisconnect={() => {
                void handleDisconnectFigma();
              }}
            />
          </div>

          {hasFigmaConnected ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Paste a Figma file link (shared/public or from your account).
                </p>
                <div className="flex gap-3">
                  <Input
                    value={figmaUrl}
                    onChange={(e) => setFigmaUrl(e.target.value)}
                    placeholder="https://www.figma.com/design/..."
                    disabled={isBuilding}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && figmaUrl.trim()) {
                        handleBuild();
                      }
                    }}
                  />
                  <Button
                    onClick={handleBuild}
                    disabled={isBuilding || !figmaUrl.trim()}
                    className="px-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white border-0"
                  >
                    {isBuilding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Building...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Build React App
                      </>
                    )}
                  </Button>
                </div>
                {buildError && (
                  <p className="text-sm text-red-500">{buildError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-10">
              <p className="text-muted-foreground">
                Connect your Figma account above to get started.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
