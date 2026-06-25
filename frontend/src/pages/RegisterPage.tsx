import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../stores/authStore";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.register(username, password);
      setAuth(data.token, data.user);
      navigate("/");
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
        background: "var(--bg, #0f0f13)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "var(--surface, #1a1a24)",
          border: "1px solid var(--border, #2a2a3a)",
          borderRadius: 12,
          padding: "40px 48px",
          width: 360,
        }}
      >
        <h1 style={{ color: "var(--text-primary, #e0e0e0)", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Cloud Agent
        </h1>
        <p style={{ color: "var(--text-muted, #666)", fontSize: 14, marginBottom: 24 }}>
          Create a new account
        </p>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "var(--text-secondary, #999)", fontSize: 13, display: "block", marginBottom: 4 }}>
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border, #2a2a3a)",
                background: "var(--editor-bg, #12121c)",
                color: "var(--text-primary, #e0e0e0)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ color: "var(--text-secondary, #999)", fontSize: 13, display: "block", marginBottom: 4 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border, #2a2a3a)",
                background: "var(--editor-bg, #12121c)",
                color: "var(--text-primary, #e0e0e0)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>
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
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p style={{ color: "var(--text-muted, #666)", fontSize: 13, marginTop: 16, textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#60a5fa", textDecoration: "none" }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
