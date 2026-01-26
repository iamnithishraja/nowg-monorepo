import { create } from "zustand";
import { shallow } from "zustand/shallow";

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

// Max terminal lines to prevent memory bloat
const MAX_TERMINAL_LINES = 1000;

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
    set((state) => {
      // Limit terminal lines to prevent memory bloat
      const newLines = [...state.terminalLines, line];
      if (newLines.length > MAX_TERMINAL_LINES) {
        return { terminalLines: newLines.slice(-MAX_TERMINAL_LINES) };
      }
      return { terminalLines: newLines };
    }),
  clearTerminal: () => set({ terminalLines: [] }),
  setIsTerminalRunning: (v) => set({ isTerminalRunning: v }),
  setIsEditActive: (v) => set({ isEditActive: v }),
  setChatMode: (mode) => set({ chatMode: mode }),
}));

// ============================================
// Optimized Selectors - Use these instead of direct store access
// These prevent unnecessary re-renders by only subscribing to specific slices
// ============================================

// Terminal state selector
export const useTerminalState = () =>
  useWorkspaceStore(
    (state) => ({
      terminalLines: state.terminalLines,
      isTerminalRunning: state.isTerminalRunning,
      appendTerminalLine: state.appendTerminalLine,
      clearTerminal: state.clearTerminal,
      setIsTerminalRunning: state.setIsTerminalRunning,
    }),
    shallow
  );

// Conversation state selector  
export const useConversationState = () =>
  useWorkspaceStore(
    (state) => ({
      conversationId: state.conversationId,
      conversationTitle: state.conversationTitle,
      setConversationId: state.setConversationId,
      setConversationTitle: state.setConversationTitle,
    }),
    shallow
  );

// Model state selector
export const useModelState = () =>
  useWorkspaceStore(
    (state) => ({
      selectedModel: state.selectedModel,
      setSelectedModel: state.setSelectedModel,
    }),
    shallow
  );

// UI state selector
export const useUIState = () =>
  useWorkspaceStore(
    (state) => ({
      activeTab: state.activeTab,
      previewUrl: state.previewUrl,
      input: state.input,
      chatMode: state.chatMode,
      setActiveTab: state.setActiveTab,
      setPreviewUrl: state.setPreviewUrl,
      setInput: state.setInput,
      setChatMode: state.setChatMode,
    }),
    shallow
  );

// Processing state selector
export const useProcessingState = () =>
  useWorkspaceStore(
    (state) => ({
      isProcessingTemplate: state.isProcessingTemplate,
      hasHandledInitialPrompt: state.hasHandledInitialPrompt,
      isReconstructingFiles: state.isReconstructingFiles,
      isEditActive: state.isEditActive,
      setIsProcessingTemplate: state.setIsProcessingTemplate,
      setHasHandledInitialPrompt: state.setHasHandledInitialPrompt,
      setIsReconstructingFiles: state.setIsReconstructingFiles,
      setIsEditActive: state.setIsEditActive,
    }),
    shallow
  );

// Individual selectors for minimal re-renders
export const useIsReconstructingFiles = () =>
  useWorkspaceStore((state) => state.isReconstructingFiles);

export const useIsProcessingTemplate = () =>
  useWorkspaceStore((state) => state.isProcessingTemplate);

export const usePreviewUrl = () =>
  useWorkspaceStore((state) => state.previewUrl);

export const useActiveTab = () =>
  useWorkspaceStore((state) => state.activeTab);

export const useConversationId = () =>
  useWorkspaceStore((state) => state.conversationId);


