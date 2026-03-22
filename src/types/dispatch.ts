// TaskStatus — 任務狀態
export type TaskStatus =
  | "pending"
  | "running"
  | "done"
  | "waiting_input"
  | "timed_out"
  | "failed";

// TaskRecord — 任務記錄
export interface TaskRecord {
  id: string;
  slug: string;
  alias: string;
  model: "opus" | "sonnet" | "haiku";
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  plan_path: string;
  output_path?: string;
  context?: string;
  error?: string;
}

// IPCMessage — IPC 問答訊息
export interface IPCMessage {
  sequence: number;
  question: string;
  background: string;
  options?: string[];
  asked_at: string;
  deadline: string;
  answer?: string;
  answered_at?: string;
}

// ChecklistItem — plan.md 中的一個項目
export interface ChecklistItem {
  index: number;
  status: "todo" | "done" | "question" | "error";
  description: string;
  note?: string;
}

// DispatchCommand — 解析後的 dispatch 指令
export interface DispatchCommand {
  alias: string;
  context: string;
  model: "opus" | "sonnet" | "haiku";
}

// AliasEntry — alias 對應表條目
export interface AliasEntry {
  alias: string;
  model: "opus" | "sonnet" | "haiku";
  templatePath: string;
  outputPath: string;
}
