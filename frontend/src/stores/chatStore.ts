import { create } from "zustand";
import type { ToolCallData, AgentState } from "../ws/events";
import { loadFileContent } from "../ws/useAgent";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCallData[];
  isStreaming?: boolean;
}

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modified: number;
}

interface SessionState {
  sessionId: string | null;
  connected: boolean;
  agentState: AgentState;
  theme: "dark" | "light";
  showAds: boolean;
  messages: ChatMessage[];
  fileTree: FileEntry[];
  fileTreePath: string;
  openFiles: string[];
  fileContents: Record<string, string>;
  terminalOutput: string;
  wsCleanup: (() => void) | null;

  setSessionId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setAgentState: (state: AgentState) => void;
  toggleTheme: () => void;
  setShowAds: (show: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastStreamingMessage: (text: string) => void;
  finalizeStreaming: () => void;
  addToolCall: (data: ToolCallData) => void;
  addToolCallResult: (toolCallId: string, result: string) => void;
  setFileTree: (path: string, entries: FileEntry[]) => void;
  openFile: (path: string, content: string) => void;
  setFileContent: (path: string, content: string) => void;
  closeFile: (path: string) => void;
  appendTerminalOutput: (text: string) => void;
  setWsCleanup: (fn: (() => void) | null) => void;
}

export const useChatStore = create<SessionState>((set, get) => ({
  sessionId: null,
  connected: false,
  agentState: "idle",
  theme: "dark",
  showAds: true,
  messages: [],
  fileTree: [],
  fileTreePath: ".",
  openFiles: [],
  fileContents: {},
  terminalOutput: "",
  wsCleanup: null,

  setSessionId: (id) => set({ sessionId: id }),
  setConnected: (connected) => set({ connected }),
  setAgentState: (agentState) => {
    set({ agentState });
    // When agent starts working, show ads again
    if (agentState === "thinking" || agentState === "executing") {
      set({ showAds: true });
    }
  },

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      return { theme: next };
    }),

  setShowAds: (show) => set({ showAds: show }),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  updateLastStreamingMessage: (text) =>
    set((state) => {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.isStreaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + text };
      }
      return { messages: msgs };
    }),

  finalizeStreaming: () =>
    set((state) => {
      const msgs = state.messages.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false } : m
      );
      return { messages: msgs };
    }),

  addToolCall: (data) =>
    set((state) => {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.isStreaming) {
        const calls = last.toolCalls || [];
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: [...calls, data],
        };
      }
      return { messages: msgs };
    }),

  addToolCallResult: (toolCallId, result) =>
    set((state) => {
      const msgs = state.messages.map((msg) => {
        if (msg.toolCalls) {
          const calls = msg.toolCalls.map((tc) =>
            tc.tool_call_id === toolCallId ? { ...tc, result } : tc
          );
          return { ...msg, toolCalls: calls };
        }
        return msg;
      });
      return { messages: msgs };
    }),

  setFileTree: (path, entries) =>
    set({ fileTree: entries, fileTreePath: path }),

  openFile: (path, content) =>
    set((state) => {
      if (state.openFiles.includes(path)) {
        return { fileContents: { ...state.fileContents, [path]: content } };
      }
      return {
        openFiles: [...state.openFiles, path],
        fileContents: { ...state.fileContents, [path]: content },
      };
    }),

  setFileContent: (path, content) =>
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content },
    })),

  closeFile: (path) =>
    set((state) => {
      const files = state.openFiles.filter((f) => f !== path);
      const contents = { ...state.fileContents };
      delete contents[path];
      return { openFiles: files, fileContents: contents };
    }),

  appendTerminalOutput: (text) =>
    set((state) => ({
      terminalOutput: state.terminalOutput + text,
    })),

  setWsCleanup: (fn) => set({ wsCleanup: fn }),
}));
