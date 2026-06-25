import { useState, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { useAgent, loadFileContent } from "../ws/useAgent";
import AdOverlay from "../components/AdOverlay";

async function createSession(): Promise<string> {
  const res = await fetch("/api/sessions", { method: "POST" });
  return (await res.json()).id;
}

export default function WorkspacePage() {
  const { sendPrompt, sendInterrupt, connect } = useAgent();
  const sessionId = useChatStore((s) => s.sessionId);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = await createSession();
        if (!cancelled) {
          const cleanup = connect(sid);
          cleanupRef.current = cleanup || null;
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Failed to create session");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Starting session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center max-w-md">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Make sure the backend server is running.</p>
        </div>
      </div>
    );
  }

  return <WorkspaceLayout sendPrompt={sendPrompt} sendInterrupt={sendInterrupt} sessionId={sessionId} />;
}

function ToggleThemeButton() {
  const theme = useChatStore((s) => s.theme);
  const toggleTheme = useChatStore((s) => s.toggleTheme);

  const handleToggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    toggleTheme();
  };

  return (
    <button
      onClick={handleToggle}
      className="p-1.5 rounded-md text-xs transition-colors"
      style={{ color: "var(--text-muted)" }}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

function DownloadAllButton({ sessionId }: { sessionId: string | null }) {
  const handleDownloadAll = () => {
    if (!sessionId) return;
    window.open(`/api/files/${sessionId}/download-all`, "_blank");
  };

  return (
    <button
      onClick={handleDownloadAll}
      className="p-1.5 rounded-md text-xs transition-colors flex items-center gap-1"
      style={{ color: "var(--text-muted)" }}
      title="Download all workspace files as zip"
    >
      ⬇ All
    </button>
  );
}

function WorkspaceLayout({ sendPrompt, sendInterrupt, sessionId }: { sendPrompt: (t: string) => void; sendInterrupt: () => void; sessionId: string | null }) {
  const agentState = useChatStore((s) => s.agentState);
  const connected = useChatStore((s) => s.connected);

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "system-ui" }}>
            Cloud Agent
          </h1>
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {connected ? "connected" : "disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DownloadAllButton sessionId={sessionId} />
          <ToggleThemeButton />
          {(agentState === "thinking" || agentState === "executing") && (
            <button
              onClick={sendInterrupt}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors bg-red-600 hover:bg-red-500 text-white"
            >
              ■ Stop
            </button>
          )}
          <span className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
            {agentState}
          </span>
          {(agentState === "thinking") && (
            <span className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: File Tree */}
        <aside
          className="w-56 overflow-y-auto p-2"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <FileTreePanel sessionId={sessionId} />
        </aside>

        {/* Center: Chat or Ad */}
        <main className="flex-1 flex flex-col min-w-0" style={{ position: "relative" }}>
          <CenterPanel sendPrompt={sendPrompt} />
        </main>

        {/* Right: Editor */}
        <aside
          className="w-96 border-l overflow-hidden hidden lg:block"
          style={{ minWidth: 0, borderColor: "var(--border)" }}
        >
          <EditorPanel />
        </aside>
      </div>
    </div>
  );
}

import ChatPanel from "../components/chat/ChatPanel";
import ChatInput from "../components/chat/ChatInput";

function FileTreePanel({ sessionId }: { sessionId: string | null }) {
  const fileTree = useChatStore((s) => s.fileTree);

  return (
    <div>
      <div
        className="text-xs font-medium uppercase tracking-wider mb-2 px-1"
        style={{ color: "var(--text-muted)" }}
      >
        Files
      </div>
      {fileTree.length === 0 ? (
        <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>No files yet</p>
      ) : (
        <div className="space-y-0.5">
          {fileTree
            .filter((e) => e.type === "file")
            .map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-1.5 px-1 py-0.5 text-xs rounded cursor-pointer transition-colors group"
                style={{
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span onClick={() => loadFileContent(sessionId, entry.name)} className="flex items-center gap-1.5 flex-1 truncate">
                  <span className="text-xs">📄</span>
                  <span className="truncate">{entry.name}</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/api/files/${sessionId}/download?path=${encodeURIComponent(entry.name)}`, "_blank");
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-1 text-xs"
                  style={{ color: "var(--text-muted)" }}
                  title="Download file"
                >
                  ⬇
                </button>
              </div>
            ))}
          {fileTree
            .filter((e) => e.type === "directory")
            .map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-1.5 px-1 py-0.5 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                <span>📁</span>
                <span>{entry.name}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function EditorPanel() {
  const openFiles = useChatStore((s) => s.openFiles);
  const fileContents = useChatStore((s) => s.fileContents);

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>
        Click a file to preview
      </div>
    );
  }

  const currentFile = openFiles[openFiles.length - 1];
  const content = fileContents[currentFile] || "";
  const getLang = (name: string) => {
    if (name.endsWith(".py")) return "python";
    if (name.endsWith(".js") || name.endsWith(".ts") || name.endsWith(".tsx"))
      return "typescript";
    if (name.endsWith(".html")) return "html";
    if (name.endsWith(".css")) return "css";
    if (name.endsWith(".json")) return "json";
    if (name.endsWith(".md")) return "markdown";
    return "plaintext";
  };

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center px-3 py-1.5"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-1 text-xs" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--text-primary)" }}>{currentFile}</span>
          <button
            onClick={() => useChatStore.getState().closeFile(currentFile)}
            className="ml-1"
            style={{ color: "var(--text-muted)" }}
          >
            ×
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-0">
        <SimpleEditor code={content} lang={getLang(currentFile)} />
      </div>
    </div>
  );
}

function SimpleEditor({ code }: { code: string }) {
  return (
    <pre
      className="h-full overflow-auto p-4 text-sm leading-relaxed"
      style={{
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
        fontSize: "13px",
        background: "var(--editor-bg)",
        color: "var(--text-primary)",
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        tabSize: 2,
      }}
    >
      <code>
        {code || (
          <span style={{ color: "var(--text-muted)" }}>// empty file</span>
        )}
      </code>
    </pre>
  );
}

function CenterPanel({ sendPrompt }: { sendPrompt: (t: string) => void }) {
  const showAds = useChatStore((s) => s.showAds);
  const setShowAds = useChatStore((s) => s.setShowAds);

  if (showAds) {
    return (
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ position: "absolute", inset: 0, zIndex: 20 }}
      >
        <AdOverlay onClose={() => setShowAds(false)} />
      </div>
    );
  }

  return (
    <>
      <ChatPanel />
      <ChatInput onSend={sendPrompt} />
    </>
  );
}
