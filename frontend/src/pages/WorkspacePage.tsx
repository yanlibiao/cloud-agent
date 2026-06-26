import { useState, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { useAuthStore } from "../stores/authStore";
import { useAgent, loadFileContent } from "../ws/useAgent";
import { api } from "../api/client";
import AdOverlay from "../components/AdOverlay";

async function createSession(): Promise<string> {
  const data = await api.sessions.create();
  return data.id;
}

async function fetchSessions() {
  try {
    return await api.sessions.list();
  } catch {
    return [];
  }
}

export default function WorkspacePage() {
  const { sendPrompt, sendInterrupt, connect } = useAgent();
  const sessionId = useChatStore((s) => s.sessionId);
  const setSessionId = useChatStore((s) => s.setSessionId);
  const sessions = useChatStore((s) => s.sessions);
  const setSessions = useChatStore((s) => s.setSessions);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useAuthStore((s) => s.logout);

  const handleNewSession = async () => {
    try {
      const sid = await createSession();
      setSessions([...sessions, { id: sid, title: "New Session" }]);
      setSessionId(sid);
      useChatStore.getState().setMessages([]);
      const cleanup = connect(sid);
      cleanupRef.current = cleanup || null;
    } catch (e: any) {
      setError(e.message || "创建会话失败");
    }
  };

  const switchSession = async (sid: string) => {
    setSessionId(sid);
    useChatStore.getState().setMessages([]);
    cleanupRef.current?.();
    try {
      const data = await api.sessions.get(sid);
      useChatStore.getState().setMessages(data.messages || []);
    } catch {}
    const cleanup = connect(sid);
    cleanupRef.current = cleanup || null;
  };

  const handleDeleteSession = async (sid: string) => {
    try {
      await api.sessions.delete(sid);
      setSessions(sessions.filter((s: any) => s.id !== sid));
      if (sessionId === sid) {
        const remaining = sessions.filter((s: any) => s.id !== sid);
        if (remaining.length > 0) {
          switchSession(remaining[0].id);
        } else {
          handleNewSession();
        }
      }
    } catch {}
  };

  const handleRenameSession = async (sid: string, title: string) => {
    try {
      await api.sessions.rename(sid, title);
      setSessions(sessions.map((s: any) => s.id === sid ? { ...s, title } : s));
    } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchSessions();
        if (cancelled) return;
        setSessions(list);

        let sid: string;
        if (list.length > 0) {
          sid = list[0].id;
          const data = await api.sessions.get(sid);
          if (!cancelled) {
            useChatStore.getState().setMessages(data.messages || []);
          }
        } else {
          sid = await createSession();
        }

        if (!cancelled) {
          setSessionId(sid);
          const cleanup = connect(sid);
          cleanupRef.current = cleanup || null;
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "创建会话失败");
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
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>启动会话...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center max-w-md">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>请确认后端服务正在运行</p>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceLayout
      sendPrompt={sendPrompt}
      sendInterrupt={sendInterrupt}
      sessionId={sessionId}
      sessions={sessions}
      onNewSession={handleNewSession}
      onSwitchSession={switchSession}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
    />
  );
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
      title={`切换到${theme === "dark" ? "明亮" : "深色"}模式`}
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
      title="下载所有文件"
    >
      ⬇ 全部下载
    </button>
  );
}

function WorkspaceLayout({
  sendPrompt, sendInterrupt, sessionId, sessions, onNewSession, onSwitchSession, onDeleteSession, onRenameSession
}: {
  sendPrompt: (t: string) => void;
  sendInterrupt: () => void;
  sessionId: string | null;
  sessions: any[];
  onNewSession: () => void;
  onSwitchSession: (sid: string) => void;
  onDeleteSession: (sid: string) => void;
  onRenameSession: (sid: string, title: string) => void;
}) {
  const agentState = useChatStore((s) => s.agentState);
  const connected = useChatStore((s) => s.connected);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
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
            {connected ? "已连接" : "已断开"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DownloadAllButton sessionId={sessionId} />
          <ToggleThemeButton />
          {(agentState === "thinking" || agentState === "executing") && (
            <button onClick={sendInterrupt} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors bg-red-600 hover:bg-red-500 text-white">
              ■ 停止
            </button>
          )}
          <span className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
            {agentState === "idle" ? "空闲" : agentState === "thinking" ? "思考中" : agentState === "executing" ? "执行中" : agentState}
          </span>
          {(agentState === "thinking") && (
            <span className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
          )}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{user?.username}</span>
          <button onClick={() => { logout(); window.location.href = "/login"; }} className="text-xs px-2 py-1 rounded transition-colors" style={{ color: "var(--text-muted)" }}>
            退出登录
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-56 overflow-y-auto p-2" style={{ borderRight: "1px solid var(--border)" }}>
          <SessionPanel sessions={sessions} currentSessionId={sessionId} onNewSession={onNewSession} onSwitchSession={onSwitchSession} onDeleteSession={onDeleteSession} onRenameSession={onRenameSession} />
          <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
          <FileTreePanel sessionId={sessionId} />
        </aside>
        <main className="flex-1 flex flex-col min-w-0" style={{ position: "relative" }}>
          <CenterPanel sendPrompt={sendPrompt} />
        </main>
        <aside className="w-96 border-l overflow-hidden hidden lg:block" style={{ minWidth: 0, borderColor: "var(--border)" }}>
          <EditorPanel />
        </aside>
      </div>
    </div>
  );
}

import ChatPanel from "../components/chat/ChatPanel";
import ChatInput from "../components/chat/ChatInput";

/* Session panel with double-click rename */
function SessionPanel({ sessions, currentSessionId, onNewSession, onSwitchSession, onDeleteSession, onRenameSession }: {
  sessions: any[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSwitchSession: (sid: string) => void;
  onDeleteSession: (sid: string) => void;
  onRenameSession: (sid: string, title: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = (sid: string, currentTitle: string) => {
    setEditingId(sid);
    setEditTitle(currentTitle);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submitRename = (sid: string) => {
    const title = editTitle.trim();
    if (title && title !== sessions.find((s: any) => s.id === sid)?.title) {
      onRenameSession(sid, title);
    }
    setEditingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          会话
        </span>
        <button onClick={onNewSession} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>
          + 新建
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>暂无会话</p>
      ) : (
        <div className="space-y-0.5">
          {sessions.map((s: any) => (
            <div
              key={s.id}
              className="flex items-center gap-1 px-1 py-0.5 text-xs rounded cursor-pointer group"
              style={{
                color: s.id === currentSessionId ? "var(--text-primary)" : "var(--text-secondary)",
                background: s.id === currentSessionId ? "var(--hover-bg, rgba(0,0,0,0.05))" : "transparent",
              }}
              onClick={() => {
                if (editingId !== s.id) onSwitchSession(s.id);
              }}
              onDoubleClick={() => startEditing(s.id, s.title)}
            >
              {editingId === s.id ? (
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent border-b text-xs outline-none min-w-0"
                  style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => submitRename(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename(s.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  {s.title === "New Session" && s.id === currentSessionId ? (
                    <span className="truncate flex-1 italic opacity-60">{s.title}</span>
                  ) : (
                    <span className="truncate flex-1">{s.title}</span>
                  )}
                </>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 px-0.5"
                title="删除会话"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileTreePanel({ sessionId }: { sessionId: string | null }) {
  const fileTree = useChatStore((s) => s.fileTree);
  const [showAll, setShowAll] = useState(false);

  // Only show these file types as "deliverables" by default
  const DELIVERABLE_EXTS = new Set([
    '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
    '.txt', '.md', '.csv',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp',
    '.html', '.htm', '.epub', '.mobi',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac',
    '.exe', '.msi', '.dmg', '.apk', '.ipa',
    '.ttf', '.otf', '.woff', '.woff2', '.iso',
    '.psd', '.ai', '.fig', '.sketch',
    '.wasm', '.drawio', '.vsdx',
  ]);

  // Directories that are clearly internal/build artifacts
  const HIDDEN_DIRS = new Set([
    'node_modules', '__pycache__', '.git', '.venv', 'venv', '.env',
    'dist', 'build', '.next', '.vite', '.cache', 'target',
  ]);

  const isDeliverable = (name: string) => {
    const dot = name.lastIndexOf('.');
    if (dot === -1) return false;
    const ext = name.substring(dot).toLowerCase();
    return DELIVERABLE_EXTS.has(ext);
  };

  const visibleFiles = showAll
    ? fileTree.filter((e) => e.type === "file")
    : fileTree.filter((e) => e.type === "file" && isDeliverable(e.name));

  const visibleDirs = fileTree.filter(
    (e) => e.type === "directory" && !HIDDEN_DIRS.has(e.name)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          文件
        </span>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs px-1.5 py-0.5 rounded transition-colors"
          style={{ color: showAll ? "var(--text-primary)" : "var(--text-muted)" }}
          title={showAll ? "仅显示产出文件" : "显示全部文件"}
        >
          {showAll ? "产出" : "全部"}
        </button>
      </div>
      {fileTree.length === 0 ? (
        <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>暂无文件</p>
      ) : (
        <div className="space-y-0.5">
          {!showAll && visibleFiles.length === 0 && visibleDirs.length === 0 ? (
            <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>暂无产出文件</p>
          ) : (
            <>
              {visibleFiles.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 px-1 py-0.5 text-xs rounded cursor-pointer transition-colors group"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span onClick={() => loadFileContent(sessionId, entry.name)} className="flex items-center gap-1.5 flex-1 truncate">
                    <span className="text-xs">{getFileIcon(entry.name)}</span>
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); window.open(`/api/files/${sessionId}/download?path=${encodeURIComponent(entry.name)}`, "_blank"); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity px-1 text-xs" style={{ color: "var(--text-muted)" }} title="下载文件">
                    ⬇
                  </button>
                </div>
              ))}
              {visibleDirs.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 px-1 py-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>📁</span>
                  <span>{entry.name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function getFileIcon(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return '📄';
  const ext = name.substring(dot).toLowerCase();
  const icons: Record<string, string> = {
    '.pdf': '📕', '.docx': '📘', '.doc': '📘', '.xlsx': '📊', '.xls': '📊',
    '.pptx': '📙', '.ppt': '📙', '.txt': '📄', '.md': '📝', '.csv': '📋',
    '.zip': '📦', '.tar': '📦', '.gz': '📦', '.rar': '📦', '.7z': '📦',
    '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.svg': '🖼️', '.webp': '🖼️',
    '.html': '🌐', '.htm': '🌐',
    '.mp3': '🎵', '.mp4': '🎬', '.wav': '🎵',
    '.exe': '⚙️', '.dmg': '💿', '.apk': '📱',
    '.json': '📋', '.xml': '📋', '.yaml': '📋', '.yml': '📋',
    '.epub': '📖', '.mobi': '📖',
    '.ico': '🖼️', '.bmp': '🖼️',
    '.psd': '🎨', '.ai': '🎨', '.fig': '🎨',
    '.wasm': '⚙️',
  };
  return icons[ext] || '📄';
}

function EditorPanel() {
  const openFiles = useChatStore((s) => s.openFiles);
  const fileContents = useChatStore((s) => s.fileContents);

  if (openFiles.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>点击文件以预览</div>;
  }

  const currentFile = openFiles[openFiles.length - 1];
  const content = fileContents[currentFile] || "";
  const getLang = (name: string) => {
    if (name.endsWith(".py")) return "python";
    if (name.endsWith(".js") || name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
    if (name.endsWith(".html")) return "html";
    if (name.endsWith(".css")) return "css";
    if (name.endsWith(".json")) return "json";
    if (name.endsWith(".md")) return "markdown";
    return "plaintext";
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center px-3 py-1.5" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1 text-xs" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--text-primary)" }}>{currentFile}</span>
          <button onClick={() => useChatStore.getState().closeFile(currentFile)} className="ml-1" style={{ color: "var(--text-muted)" }}>×</button>
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
    <pre className="h-full overflow-auto p-4 text-sm leading-relaxed" style={{
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
      fontSize: "13px", background: "var(--editor-bg)", color: "var(--text-primary)",
      margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", tabSize: 2,
    }}>
      <code>{code || <span style={{ color: "var(--text-muted)" }}>// 空文件</span>}</code>
    </pre>
  );
}

function CenterPanel({ sendPrompt }: { sendPrompt: (t: string) => void }) {
  const showAds = useChatStore((s) => s.showAds);
  const setShowAds = useChatStore((s) => s.setShowAds);

  if (showAds) {
    return <div className="flex-1 flex flex-col min-w-0" style={{ position: "absolute", inset: 0, zIndex: 20 }}>
      <AdOverlay onClose={() => setShowAds(false)} />
    </div>;
  }

  return <><ChatPanel /><ChatInput onSend={sendPrompt} /></>;
}
