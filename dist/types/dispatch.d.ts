export type TaskStatus = "pending" | "running" | "done" | "waiting_input" | "timed_out" | "failed";
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
export interface ChecklistItem {
    index: number;
    status: "todo" | "done" | "question" | "error";
    description: string;
    note?: string;
}
export interface DispatchCommand {
    alias: string;
    context: string;
    model: "opus" | "sonnet" | "haiku";
}
export interface AliasEntry {
    alias: string;
    model: "opus" | "sonnet" | "haiku";
    templatePath: string;
    outputPath: string;
}
//# sourceMappingURL=dispatch.d.ts.map