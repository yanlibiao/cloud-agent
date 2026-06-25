import { useEffect, useRef } from "react";
import { useChatStore } from "../../stores/chatStore";

export default function TerminalPanel() {
  const terminalOutput = useChatStore((s) => s.terminalOutput);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--terminal-bg)" }}>
      <div
        className="flex items-center justify-between px-3 py-1.5 text-xs"
        style={{
          background: "var(--terminal-header)",
          borderBottom: "1px solid var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        <span>Terminal</span>
        <span style={{ color: "var(--text-muted)" }}>agent output</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {terminalOutput || (
          <span style={{ color: "var(--text-muted)" }}>
            Agent command output appears here...
          </span>
        )}
      </div>
    </div>
  );
}
