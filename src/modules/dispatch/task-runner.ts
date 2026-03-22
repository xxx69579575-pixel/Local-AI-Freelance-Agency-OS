// Dispatch module — task lifecycle management (dispatch-module.md § 3.5)
import { v4 as uuidv4 } from "uuid";
import { getAliasEntry } from "./alias-registry.js";
import { renderTemplate } from "./template-engine.js";
import { atomicWrite, writeFile, readFile, fileExists } from "../../utils/file-writer.js";
import { WaitingForInputError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { CONFIG } from "../../config.js";
import type { TaskRecord, TaskStatus } from "../../types/dispatch.js";

// In-memory task store, backed by tasks.json for persistence
const taskStore = new Map<string, TaskRecord>();
const TASKS_FILE = `${CONFIG.paths.dispatch}/tasks.json`;
let initialized = false;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function saveTasks(): Promise<void> {
  try {
    const data = JSON.stringify([...taskStore.values()], null, 2);
    await atomicWrite(TASKS_FILE, data);
  } catch (err) {
    logger.warn("Failed to persist tasks", { err });
  }
}

/**
 * Load tasks from disk into the in-memory store.
 * Call once at server startup.
 */
export async function loadTasks(): Promise<void> {
  const content = await readFile(TASKS_FILE);
  if (!content) return;
  try {
    const records = JSON.parse(content) as TaskRecord[];
    for (const r of records) taskStore.set(r.id, r);
    logger.info("Tasks loaded from disk", { count: records.length });
  } catch {
    logger.warn("tasks.json is corrupt — starting with empty store");
  }
  initialized = true;
}

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

/**
 * Create and initialise a task from a dispatch command.
 * Returns the new TaskRecord with status = "pending".
 */
export async function createTask(
  alias: string,
  context: string,
  slug: string,
  model: "opus" | "sonnet" | "haiku",
): Promise<TaskRecord> {
  const entry = getAliasEntry(alias);
  const id = uuidv4();
  const now = new Date().toISOString();
  const taskDir = `${CONFIG.paths.dispatch}/${slug}`;
  const planPath = `${taskDir}/plan.md`;

  // Render and write plan.md
  const rendered = await renderTemplate(entry.templatePath, {
    alias,
    context,
    model,
    slug,
    started_at: now,
  });
  await writeFile(planPath, rendered);
  await writeFile(`${taskDir}/ipc/.gitkeep`, "");

  const record: TaskRecord = {
    id,
    slug,
    alias,
    model,
    status: "pending",
    created_at: now,
    updated_at: now,
    plan_path: planPath,
  };

  taskStore.set(id, record);
  initialized = true;
  await saveTasks();
  logger.info("Task created", { id, slug, alias });
  return record;
}

/**
 * Transition task to a new status.
 */
export function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  extra?: Partial<Pick<TaskRecord, "output_path" | "context" | "error">>,
): TaskRecord {
  const record = taskStore.get(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);

  const updated: TaskRecord = {
    ...record,
    ...extra,
    status,
    updated_at: new Date().toISOString(),
  };
  taskStore.set(taskId, updated);
  // fire-and-forget persistence
  saveTasks().catch(() => undefined);
  return updated;
}

export function getTask(taskId: string): TaskRecord | undefined {
  if (!initialized) {
    logger.warn("taskStore not initialized — call loadTasks() before getTask()");
    return undefined;
  }
  return taskStore.get(taskId);
}

export function listTasks(): TaskRecord[] {
  if (!initialized) {
    logger.warn("taskStore not initialized — call loadTasks() before listTasks()");
    return [];
  }
  return [...taskStore.values()];
}

/**
 * Handle WaitingForInputError thrown during task execution:
 * save context to memory and disk, then transition to WAITING_INPUT.
 */
export async function handleWaitingForInput(
  taskId: string,
  err: WaitingForInputError,
  contextSummary?: string,
): Promise<void> {
  updateTaskStatus(taskId, "waiting_input", { context: contextSummary });
  if (contextSummary) {
    const record = getTask(taskId);
    if (record) {
      const contextPath = `${CONFIG.paths.dispatch}/${record.slug}/context.md`;
      await writeFile(contextPath, contextSummary).catch((e: unknown) => {
        logger.warn("Failed to write context.md", { taskId, error: (e as Error).message });
      });
    }
  }
  logger.info("Task waiting for input", { taskId, sequence: err.sequence });
}

// ---------------------------------------------------------------------------
// Stop / cancel / delete task (DELETE endpoint — RV-016)
// ---------------------------------------------------------------------------

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
export async function stopTask(taskId: string): Promise<StopTaskResult> {
  const record = taskStore.get(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);

  if (record.status === "running" || record.status === "waiting_input") {
    let context_saved = false;

    // Write context.md if there is context data
    if (record.context) {
      const contextPath = `${CONFIG.paths.dispatch}/${record.slug}/context.md`;
      if (!(await fileExists(contextPath))) {
        await writeFile(contextPath, record.context);
      }
      context_saved = true;
    }

    updateTaskStatus(taskId, "failed", { error: "Stopped by user" });
    return { status: "stopped", context_saved };
  }

  if (record.status === "pending") {
    taskStore.delete(taskId);
    await saveTasks();
    return { status: "cancelled", context_saved: false };
  }

  // done / failed / timed_out
  taskStore.delete(taskId);
  await saveTasks();
  return { status: "deleted", context_saved: false };
}
