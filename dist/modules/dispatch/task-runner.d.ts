import { WaitingForInputError } from "../../utils/errors.js";
import type { TaskRecord, TaskStatus } from "../../types/dispatch.js";
/**
 * Load tasks from disk into the in-memory store.
 * Call once at server startup.
 */
export declare function loadTasks(): Promise<void>;
/**
 * Create and initialise a task from a dispatch command.
 * Returns the new TaskRecord with status = "pending".
 */
export declare function createTask(alias: string, context: string, slug: string, model: "opus" | "sonnet" | "haiku"): Promise<TaskRecord>;
/**
 * Transition task to a new status.
 */
export declare function updateTaskStatus(taskId: string, status: TaskStatus, extra?: Partial<Pick<TaskRecord, "output_path" | "context" | "error">>): TaskRecord;
export declare function getTask(taskId: string): TaskRecord | undefined;
export declare function listTasks(): TaskRecord[];
/**
 * Handle WaitingForInputError thrown during task execution:
 * save context and transition to WAITING_INPUT.
 */
export declare function handleWaitingForInput(taskId: string, err: WaitingForInputError, contextSummary?: string): void;
export interface StopTaskResult {
    status: "stopped" | "cancelled" | "deleted";
    context_saved: boolean;
}
/**
 * Stop, cancel, or delete a task depending on its current status.
 *
 * running / waiting_input → stopped  (context_saved: true if context exists)
 * pending                 → cancelled (context_saved: false)
 * done / failed / timed_out → deleted (context_saved: false)
 */
export declare function stopTask(taskId: string): Promise<StopTaskResult>;
//# sourceMappingURL=task-runner.d.ts.map