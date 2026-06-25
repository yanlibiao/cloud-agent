import { create } from "zustand";

interface AuthState {
  token: string | null;
  user: { id: number; username: string; display_name: string } | null;
  isAuthenticated: boolean;

  setAuth: (token: string, user: { id: number; username: string; display_name: string }) => void;
  logout: () => void;
  loadToken: () => boolean; // returns true if token was loaded
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) => {
    localStorage.setItem("cloud_agent_auth", JSON.stringify({ token, user }));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("cloud_agent_auth");
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadToken: () => {
    try {
      const raw = localStorage.getItem("cloud_agent_auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.token) {
          set({ token: parsed.token, user: parsed.user || null, isAuthenticated: true });
          return true;
        }
      }
    } catch {}
    return false;
  },
}));
