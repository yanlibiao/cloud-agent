import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../../stores/chatStore";
import type { ChatMessage } from "../../stores/chatStore";
import Markdown from "../Markdown";

function ToolCallItem({ toolCall }: { toolCall: any }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning =
    toolCall.status === "running" || (!toolCall.result && !toolCall.status);
  const label = `$${
    toolCall.tool_name === "exec_command"
      ? toolCall.args?.command || ""
      : toolCall.tool_name
  }`;

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
    >
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-mono transition-colors"
        style={{ color: "var(--text-secondary)" }}
        onClick={() => setExpanded(!expanded)}
      >
        {isRunning ? (
          <span className="text-yellow-400 w-4 h-4 inline-block">
            <span className="animate-spin">⟳</span>
          </span>
        ) : toolCall.result ? (
          <span className="text-green-400">✓</span>
        ) : (
          <span className="text-red-400">✗</span>
        )}
        <span className="truncate flex-1">{label}</span>
        <span>{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div
          className="px-3 py-2 border-t text-xs font-mono max-h-48 overflow-y-auto"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <div className="mb-1" style={{ color: "var(--text-muted)" }}>
            Arguments:
          </div>
          <pre className="mb-2" style={{ color: "var(--text-primary)" }}>
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
          {toolCall.result && (
            <>
              <div className="mb-1" style={{ color: "var(--text-muted)" }}>
                Result:
              </div>
              <pre className="whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                {toolCall.result}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MessageItem({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "tool") return null;

  return (
    <div className="mb-4">
      <div
        className="text-sm leading-relaxed"
        style={{ color: "var(--text-primary)" }}
      >
        {msg.isStreaming ? (
          <span>
            <Markdown content={msg.content} />
            <span className="animate-pulse" style={{ color: "var(--text-secondary)" }}>
              ▌
            </span>
          </span>
        ) : (
          <Markdown content={msg.content} />
        )}
      </div>
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {msg.toolCalls.map((tc: any) => (
            <ToolCallItem key={tc.tool_call_id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.length === 0 && (
        <div
          className="flex flex-col items-center justify-center h-full"
          style={{ color: "var(--text-muted)" }}
        >
          <div className="text-4xl mb-3">⚡</div>
          <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>
            Cloud Agent
          </p>
          <p className="text-sm mt-1">描述你想要构建的功能</p>
        </div>
      )}
      {messages
        .filter((m) => m.role !== "tool")
        .map((msg) => (
          <MessageItem key={msg.id} msg={msg} />
        ))}
      <div ref={bottomRef} />
    </div>
  );
}
