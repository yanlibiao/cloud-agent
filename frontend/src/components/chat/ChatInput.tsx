import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useChatStore } from "../../stores/chatStore";

interface ChatInputProps {
  onSend: (text: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentState = useChatStore((s) => s.agentState);
  const isDisabled = agentState === "thinking" || agentState === "executing";

  useEffect(() => {
    if (!isDisabled) {
      textareaRef.current?.focus();
    }
  }, [isDisabled]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isDisabled) return;
    onSend(text);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  return (
    <div
      className="border-t p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isDisabled ? "Agent is working..." : "Describe what you want to build..."
          }
          disabled={isDisabled}
          rows={1}
          className="flex-1 rounded-lg px-3 py-2.5 text-sm resize-none outline-none border disabled:opacity-50 placeholder:opacity-50"
          style={{
            background: "var(--input-bg)",
            color: "var(--text-primary)",
            borderColor: "var(--input-border)",
          }}
        />
        <button
          onClick={handleSend}
          disabled={isDisabled || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:text-gray-500"
        >
          {isDisabled ? (
            <span className="flex items-center gap-1">
              <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
            </span>
          ) : (
            "Send"
          )}
        </button>
      </div>
    </div>
  );
}
