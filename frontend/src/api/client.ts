const BASE = "/api";

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("cloud_agent_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.token || null;
    }
  } catch {}
  return null;
}

async function request(method: string, path: string, body?: any): Promise<any> {
  const headers: Record<string, string> = {};
  const isAuthEndpoint = path.startsWith("/auth/");

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Only redirect to login on 401 for protected endpoints, not for auth endpoints
  if (res.status === 401 && !isAuthEndpoint) {
    localStorage.removeItem("cloud_agent_auth");
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    // FastAPI validation errors return detail as an array
    let message: string;
    if (Array.isArray(data.detail)) {
      message = data.detail.map((e: any) => e.msg || String(e)).join("; ");
    } else if (typeof data.detail === "string") {
      message = data.detail;
    } else {
      message = `Request failed: ${res.status}`;
    }
    throw new Error(message);
  }

  return res.json();
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: any) => request("POST", path, body),
  put: (path: string, body?: any) => request("PUT", path, body),
  delete: (path: string) => request("DELETE", path),

  auth: {
    login: (username: string, password: string) =>
      request("POST", "/auth/login", { username, password }),
    register: (username: string, password: string) =>
      request("POST", "/auth/register", { username, password }),
    me: () => request("GET", "/auth/me"),
  },

  sessions: {
    list: () => request("GET", "/sessions"),
    create: () => request("POST", "/sessions"),
    get: (id: string) => request("GET", `/sessions/${id}`),
    delete: (id: string) => request("DELETE", `/sessions/${id}`),
    rename: (id: string, title: string) => request("PUT", `/sessions/${id}/title`, { title }),
  },
};
