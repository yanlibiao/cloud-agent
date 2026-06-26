import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../stores/authStore";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const data = await api.auth.register(username, password);
      setAuth(data.token, data.user);
      setSuccess("🎉 注册成功！即将跳转...");
      setTimeout(() => navigate("/"), 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #f5f5f7)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "var(--surface, #fff)",
          border: "1px solid var(--border, #e0e0e0)",
          borderRadius: 12,
          padding: "40px 48px",
          width: 360,
        }}
      >
        <h1 style={{ color: "var(--text-primary, #1a1a1a)", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Cloud Agent
        </h1>
        <p style={{ color: "var(--text-muted, #888)", fontSize: 14, marginBottom: 24 }}>
          创建新账号
        </p>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "var(--text-secondary, #666)", fontSize: 13, display: "block", marginBottom: 4 }}>
              用户名
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border, #e0e0e0)",
                background: "var(--editor-bg, #fafafa)",
                color: "var(--text-primary, #1a1a1a)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ color: "var(--text-secondary, #666)", fontSize: 13, display: "block", marginBottom: 4 }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border, #e0e0e0)",
                background: "var(--editor-bg, #fafafa)",
                color: "var(--text-primary, #1a1a1a)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          {success && (
            <p style={{ color: "#4ade80", fontSize: 13, marginBottom: 12 }}>{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 6,
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "创建中..." : "注册"}
          </button>
        </form>

        <p style={{ color: "var(--text-muted, #888)", fontSize: 13, marginTop: 16, textAlign: "center" }}>
          已有账号？{" "}
          <Link to="/login" style={{ color: "#60a5fa", textDecoration: "none" }}>
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
