import type { ChecklistItem } from "../../types/dispatch.js";
/**
 * Parse a plan.md string into a list of ChecklistItem.
 */
export declare function parsePlan(content: string): ChecklistItem[];
/**
 * Update a single item's status and optional note.
 */
export declare function updateItem(items: ChecklistItem[], index: number, status: ChecklistItem["status"], note?: string): ChecklistItem[];
/**
 * Serialize ChecklistItems back to the plan.md checklist section.
 * Preserves non-checklist lines (title, metadata) from the original content.
 */
export declare function serializePlan(originalContent: string, items: ChecklistItem[]): string;
export declare function markItemDone(planPath: string, index: number, note?: string): Promise<void>;
export declare function markItemQuestion(planPath: string, index: number, question: string): Promise<void>;
export declare function markItemError(planPath: string, index: number, error: string): Promise<void>;
//# sourceMappingURL=plan-manager.d.ts.map