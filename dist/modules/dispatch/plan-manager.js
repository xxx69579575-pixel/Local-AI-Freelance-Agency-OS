// Dispatch module — plan.md checklist management (dispatch-module.md § 4.5)
import { readFile, writeFile } from "../../utils/file-writer.js";
const STATUS_MAP = {
    " ": "todo",
    x: "done",
    "?": "question",
    "!": "error",
};
const STATUS_CHAR = {
    todo: " ",
    done: "x",
    question: "?",
    error: "!",
};
/**
 * Parse a plan.md string into a list of ChecklistItem.
 */
export function parsePlan(content) {
    const items = [];
    const lines = content.split("\n");
    let index = 0;
    for (const line of lines) {
        const match = /^- \[(.)\] (.+?)(?:<!--\s*(.*?)\s*-->)?$/.exec(line);
        if (!match)
            continue;
        const [, statusChar, description, noteRaw] = match;
        const status = STATUS_MAP[statusChar ?? " "] ?? "todo";
        items.push({
            index,
            status,
            description: description?.trim() ?? "",
            note: noteRaw?.trim() || undefined,
        });
        index++;
    }
    return items;
}
/**
 * Update a single item's status and optional note.
 */
export function updateItem(items, index, status, note) {
    return items.map((item) => item.index === index ? { ...item, status, note } : item);
}
/**
 * Serialize ChecklistItems back to the plan.md checklist section.
 * Preserves non-checklist lines (title, metadata) from the original content.
 */
export function serializePlan(originalContent, items) {
    const lines = originalContent.split("\n");
    let itemIdx = 0;
    const result = [];
    for (const line of lines) {
        if (/^- \[.\]/.test(line) && itemIdx < items.length) {
            const item = items[itemIdx++];
            const char = STATUS_CHAR[item.status];
            const note = item.note ? `<!-- ${item.note} -->` : "";
            result.push(`- [${char}] ${item.description}${note ? " " + note : ""}`);
        }
        else {
            result.push(line);
        }
    }
    return result.join("\n");
}
// ---------------------------------------------------------------------------
// File-level helpers
// ---------------------------------------------------------------------------
export async function markItemDone(planPath, index, note) {
    const content = (await readFile(planPath)) ?? "";
    const items = updateItem(parsePlan(content), index, "done", note);
    await writeFile(planPath, serializePlan(content, items));
}
export async function markItemQuestion(planPath, index, question) {
    const content = (await readFile(planPath)) ?? "";
    const items = updateItem(parsePlan(content), index, "question", `question: ${question}`);
    await writeFile(planPath, serializePlan(content, items));
}
export async function markItemError(planPath, index, error) {
    const content = (await readFile(planPath)) ?? "";
    const items = updateItem(parsePlan(content), index, "error", `error: ${error}`);
    await writeFile(planPath, serializePlan(content, items));
}
//# sourceMappingURL=plan-manager.js.map