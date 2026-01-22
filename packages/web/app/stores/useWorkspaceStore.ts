import { create } from "zustand";

export type TabType = "files" | "preview";
export type ChatMode = "build" | "ask";

interface WorkspaceState {
  selectedModel: string;
  conversationId: string | null;
  conversationTitle: string | null;
  input: string;
  activeTab: TabType;
  previewUrl: string | null | undefined;
  isProcessingTemplate: boolean;
  hasHandledInitialPrompt: boolean;
  isReconstructingFiles: boolean;
  // edit/inspector state
  isEditActive: boolean;
  // terminal state
  terminalLines: string[];
  isTerminalRunning: boolean;
  // chat mode
  chatMode: ChatMode;
  setSelectedModel: (model: string) => void;
  setConversationId: (id: string | null) => void;
  setConversationTitle: (title: string | null) => void;
  setInput: (value: string) => void;
  setActiveTab: (tab: TabType) => void;
  setPreviewUrl: (url: string | null | undefined) => void;
  setIsProcessingTemplate: (value: boolean) => void;
  setHasHandledInitialPrompt: (value: boolean) => void;
  setIsReconstructingFiles: (value: boolean) => void;
  appendTerminalLine: (line: string) => void;
  clearTerminal: () => void;
  setIsTerminalRunning: (v: boolean) => void;
  setIsEditActive: (v: boolean) => void;
  setChatMode: (mode: ChatMode) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedModel: "",
  conversationId: null,
  conversationTitle: null,
  input: "",
  activeTab: "preview",
  previewUrl: undefined,
  isProcessingTemplate: false,
  hasHandledInitialPrompt: false,
  isReconstructingFiles: false,
  isEditActive: false,
  terminalLines: [],
  isTerminalRunning: false,
  chatMode: "build",
  setSelectedModel: (model) => set({ selectedModel: model }),
  setConversationId: (id) => set({ conversationId: id }),
  setConversationTitle: (title) => set({ conversationTitle: title }),
  setInput: (value) => set({ input: value }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  setIsProcessingTemplate: (value) => set({ isProcessingTemplate: value }),
  setHasHandledInitialPrompt: (value) => set({ hasHandledInitialPrompt: value }),
  setIsReconstructingFiles: (value) => set({ isReconstructingFiles: value }),
  appendTerminalLine: (line) =>
    set((state) => ({ terminalLines: [...state.terminalLines, line] })),
  clearTerminal: () => set({ terminalLines: [] }),
  setIsTerminalRunning: (v) => set({ isTerminalRunning: v }),
  setIsEditActive: (v) => set({ isEditActive: v }),
  setChatMode: (mode) => set({ chatMode: mode }),
}));


