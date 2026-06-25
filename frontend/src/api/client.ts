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

  if (res.status === 401) {
    // Token expired — redirect to login
    localStorage.removeItem("cloud_agent_auth");
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail.detail || `Request failed: ${res.status}`);
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
