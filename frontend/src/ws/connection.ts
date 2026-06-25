// WebSocket connection manager with reconnection logic
import type { ServerEvent } from "./events";

type EventHandler = (event: ServerEvent) => void;
type StatusHandler = (connected: boolean) => void;

export class AgentWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private url: string;
  private eventHandlers: Set<EventHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private shouldReconnect = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const token = localStorage.getItem("cloud_agent_auth");
    let tokenParam = "";
    if (token) {
      try { tokenParam = `?token=${encodeURIComponent(JSON.parse(token).token)}`; } catch {}
    }
    this.url = `${protocol}//${host}/ws/${sessionId}${tokenParam}`;
  }

  connect() {
    this.shouldReconnect = true;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.notifyStatus(true);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const lines = event.data.split("\n").filter(Boolean);
        for (const line of lines) {
          const parsed: ServerEvent = JSON.parse(line);
          this.eventHandlers.forEach((handler) => handler(parsed));
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    this.ws.onclose = () => {
      this.notifyStatus(false);
      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendUserPrompt(text: string) {
    this.send({ type: "user_prompt", text });
  }

  sendInterrupt() {
    this.send({ type: "interrupt" });
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private notifyStatus(connected: boolean) {
    this.statusHandlers.forEach((handler) => handler(connected));
  }
}
