// WebSocket event types shared between backend and frontend
export interface ServerEvent {
  type: string;
  data?: any;
}

export interface ToolCallData {
  tool_call_id: string;
  tool_name: string;
  args?: any;
  result?: string;
  status?: string;
}

export type AgentState = "idle" | "thinking" | "executing" | "error";
