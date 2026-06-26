import { useEffect, useRef, useCallback } from "react";
import { AgentWebSocket } from "./connection";
import { useChatStore } from "../stores/chatStore";
import type { ServerEvent } from "./events";

let msgSeq = 0;

export function useAgent() {
  const wsRef = useRef<AgentWebSocket | null>(null);

  const connect = useCallback((sid: string) => {
    const store = useChatStore.getState();
    store.setSessionId(sid);
    store.setAgentState("idle");

    const ws = new AgentWebSocket(sid);
    wsRef.current = ws;

    ws.onEvent((event: ServerEvent) => {
      const s = useChatStore.getState();

      switch (event.type) {
        case "session_state":
          if (event.data?.status === "ready") {
            fetchFileTree(sid);
          }
          break;

        case "agent_text_delta":
          s.setAgentState("thinking");
          const text = event.data?.text || "";
          const msgs = s.messages;
          const last = msgs[msgs.length - 1];

          if (last && last.role === "assistant" && last.isStreaming) {
            s.updateLastStreamingMessage(text);
          } else {
            s.addMessage({
              id: `msg_${++msgSeq}`,
              role: "assistant",
              content: text,
              isStreaming: true,
            });
          }
          break;

        case "tool_call_begin":
          s.setAgentState("executing");
          s.addToolCall({
            tool_call_id: event.data?.tool_call_id,
            tool_name: event.data?.tool_name,
            args: event.data?.args,
            status: "running",
          });
          // Update progress with tool name
          const toolName = event.data?.tool_name || "";
          const args = event.data?.args || {};
          const cmd = toolName === "exec_command" ? (args.command || "").slice(0, 60) : "";
          s.setExecutionProgress(cmd ? `执行: ${cmd}` : `调用: ${toolName}`);
          break;

        case "tool_call_end":
          s.addToolCallResult(event.data?.tool_call_id, event.data?.result || "");
          if (event.data?.tool_name === "exec_command") {
            s.appendTerminalOutput(`${event.data?.result || ""}\n\n`);
          }
          break;

        case "file_changed":
          fetchFileTree(sid);
          break;

        case "turn_completed":
          s.setAgentState("idle");
          s.finalizeStreaming();
          s.setExecutionProgress("100%");
          break;

        case "error":
          s.setAgentState("error");
          s.addMessage({
            id: `msg_${++msgSeq}`,
            role: "assistant",
            content: `Error: ${event.data?.message || "Unknown error"}`,
          });
          break;
      }
    });

    ws.onStatus((connected) => {
      useChatStore.getState().setConnected(connected);
    });

    ws.connect();

    // Return cleanup function for useEffect
    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, []);

  const sendPrompt = useCallback((text: string) => {
    if (!text.trim()) return;

    const s = useChatStore.getState();
    s.addMessage({
      id: `msg_${++msgSeq}`,
      role: "user",
      content: text,
    });

    s.setAgentState("thinking");
    wsRef.current?.sendUserPrompt(text);
  }, []);

  const sendInterrupt = useCallback(() => {
    wsRef.current?.sendInterrupt();
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
  }, []);

  return { connect, sendPrompt, sendInterrupt, disconnect };
}

async function fetchFileTree(sessionId: string) {
  try {
    const res = await fetch(`/api/files/${sessionId}/tree`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.entries) {
      useChatStore.getState().setFileTree(data.path, data.entries);
    }
  } catch {
    // ignore
  }
}

export async function loadFileContent(sessionId: string | null, path: string) {
  if (!sessionId) return;
  try {
    const res = await fetch(`/api/files/${sessionId}/read?path=${encodeURIComponent(path)}`);
    if (!res.ok) return;
    const data = await res.json();
    useChatStore.getState().openFile(path, data.content || "");
  } catch {
    // ignore
  }
}
