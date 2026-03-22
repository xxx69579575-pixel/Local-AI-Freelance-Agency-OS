// Dispatch module — REST API route handler (dispatch-module.md § 4.2)
import fs from "node:fs/promises";
import { parseDispatchCommand, resolveTaskSlug } from "./command-parser.js";
import { createTask, updateTaskStatus, getTask, listTasks, stopTask, } from "./task-runner.js";
import { writeAnswer, isQuestionTimedOut, readQuestion } from "./ipc-manager.js";
import { InvalidAliasError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { CONFIG } from "../../config.js";
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
            data += chunk.toString();
        });
        req.on("end", () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            }
            catch {
                reject(new Error("Invalid JSON body"));
            }
        });
        req.on("error", reject);
    });
}
function send(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(json);
}
function statusCounts(tasks) {
    return {
        running: tasks.filter((t) => t.status === "running").length,
        done: tasks.filter((t) => t.status === "done").length,
        failed: tasks.filter((t) => t.status === "failed").length,
        timed_out: tasks.filter((t) => t.status === "timed_out").length,
        waiting_input: tasks.filter((t) => t.status === "waiting_input").length,
        pending: tasks.filter((t) => t.status === "pending").length,
    };
}
async function getPendingQuestion(slug) {
    const ipcDir = `${CONFIG.paths.dispatch}/${slug}/ipc`;
    try {
        const entries = await fs.readdir(ipcDir);
        const questionFiles = entries
            .filter((f) => /^\d{3}\.question$/.test(f))
            .sort()
            .reverse();
        for (const qFile of questionFiles) {
            const seq = parseInt(qFile.slice(0, 3), 10);
            const doneFile = `${String(seq).padStart(3, "0")}.done`;
            if (!entries.includes(doneFile)) {
                const content = await readQuestion(slug, seq);
                if (!content)
                    continue;
                const questionMatch = /\*\*問題\*\*：(.+)/.exec(content);
                const deadlineMatch = /\*\*等待截止\*\*：(.+)/.exec(content);
                return {
                    sequence: seq,
                    question: questionMatch?.[1]?.trim() ?? "",
                    deadline: deadlineMatch?.[1]?.trim() ?? "",
                };
            }
        }
    }
    catch {
        // ipc dir may not exist yet
    }
    return null;
}
// ---------------------------------------------------------------------------
// Route handler — returns true if the request was handled
// ---------------------------------------------------------------------------
/**
 * Handle all /api/dispatch/* requests.
 * Returns true if the request matched a route, false otherwise.
 */
export async function handleDispatchRequest(req, res) {
    const rawUrl = req.url ?? "/";
    const parsed = new URL(rawUrl, "http://localhost");
    const pathname = parsed.pathname;
    const method = req.method ?? "GET";
    // ── POST /api/dispatch ──────────────────────────────────────────────────
    if (method === "POST" && pathname === "/api/dispatch") {
        try {
            const body = await readBody(req);
            const alias = String(body["alias"] ?? "").trim();
            const context = String(body["context"] ?? "").trim();
            const rawModel = body["model"];
            if (!alias) {
                send(res, 400, { status: "error", message: "alias is required" });
                return true;
            }
            let command;
            try {
                command = parseDispatchCommand(context ? `${alias}: ${context}` : alias);
            }
            catch (err) {
                if (err instanceof InvalidAliasError) {
                    send(res, 400, { status: "error", message: err.message });
                    return true;
                }
                throw err;
            }
            if (rawModel && ["opus", "sonnet", "haiku"].includes(rawModel)) {
                command = { ...command, model: rawModel };
            }
            const slug = await resolveTaskSlug(command);
            const task = await createTask(command.alias, command.context, slug, command.model);
            updateTaskStatus(task.id, "running");
            send(res, 201, {
                task_id: task.id,
                slug: task.slug,
                status: "running",
                plan_path: task.plan_path,
            });
        }
        catch (err) {
            logger.error("POST /api/dispatch failed", { err });
            send(res, 500, { status: "error", message: String(err) });
        }
        return true;
    }
    // ── GET /api/dispatch/tasks/:task_id ────────────────────────────────────
    const singleMatch = /^\/api\/dispatch\/tasks\/([^/]+)$/.exec(pathname);
    if (method === "GET" && singleMatch) {
        const taskId = singleMatch[1];
        const task = getTask(taskId);
        if (!task) {
            send(res, 404, { status: "error", message: `Task not found: ${taskId}` });
            return true;
        }
        let pending_question = null;
        if (task.status === "waiting_input") {
            pending_question = await getPendingQuestion(task.slug);
            // Detect timed_out
            if (pending_question) {
                const timedOut = new Date() > new Date(pending_question.deadline);
                if (timedOut) {
                    updateTaskStatus(taskId, "timed_out");
                }
            }
        }
        send(res, 200, { ...task, task_id: task.id, pending_question });
        return true;
    }
    // ── GET /api/dispatch/tasks ─────────────────────────────────────────────
    if (method === "GET" && pathname === "/api/dispatch/tasks") {
        const statusFilter = parsed.searchParams.get("status");
        const limit = Math.max(1, parseInt(parsed.searchParams.get("limit") ?? "20", 10));
        const offset = Math.max(0, parseInt(parsed.searchParams.get("offset") ?? "0", 10));
        const all = listTasks();
        const filtered = statusFilter ? all.filter((t) => t.status === statusFilter) : all;
        const paginated = filtered.slice(offset, offset + limit);
        send(res, 200, {
            tasks: paginated,
            total: filtered.length,
            ...statusCounts(all),
        });
        return true;
    }
    // ── POST /api/dispatch/tasks/:task_id/answer ─────────────────────────────
    const answerMatch = /^\/api\/dispatch\/tasks\/([^/]+)\/answer$/.exec(pathname);
    if (method === "POST" && answerMatch) {
        const taskId = answerMatch[1];
        const task = getTask(taskId);
        if (!task) {
            send(res, 404, { status: "error", message: `Task not found: ${taskId}` });
            return true;
        }
        try {
            const body = await readBody(req);
            const sequence = Number(body["sequence"]);
            const answer = String(body["answer"] ?? "");
            if (!answer.trim()) {
                send(res, 400, { status: "error", message: "answer cannot be empty" });
                return true;
            }
            await writeAnswer(task.slug, sequence, answer);
            // Check timeout after writing
            const timedOut = await isQuestionTimedOut(task.slug, sequence);
            if (timedOut) {
                updateTaskStatus(taskId, "timed_out");
            }
            send(res, 200, { status: "ok", task_status: getTask(taskId).status });
        }
        catch (err) {
            send(res, 400, { status: "error", message: String(err) });
        }
        return true;
    }
    // ── DELETE /api/dispatch/tasks/:task_id ──────────────────────────────────
    const deleteMatch = /^\/api\/dispatch\/tasks\/([^/]+)$/.exec(pathname);
    if (method === "DELETE" && deleteMatch) {
        const taskId = deleteMatch[1];
        if (!getTask(taskId)) {
            send(res, 404, { status: "error", message: `Task not found: ${taskId}` });
            return true;
        }
        try {
            const result = await stopTask(taskId);
            send(res, 200, result);
        }
        catch (err) {
            send(res, 500, { status: "error", message: String(err) });
        }
        return true;
    }
    return false; // not handled by this router
}
//# sourceMappingURL=api.js.map