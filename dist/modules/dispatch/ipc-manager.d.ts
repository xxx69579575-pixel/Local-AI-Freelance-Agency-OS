/**
 * Write a question file atomically, then throw WaitingForInputError.
 * The calling task-runner catches this and sets status = WAITING_INPUT.
 */
export declare function askAndPause(taskSlug: string, seq: number, question: string, background: string, options?: string[]): Promise<never>;
/**
 * Check for a pending answer (single read, no polling).
 * Returns the answer text if found and non-empty, otherwise null.
 * On success, writes the .done marker.
 */
export declare function checkPendingAnswer(taskSlug: string, seq: number): Promise<string | null>;
/**
 * Atomically write an answer file (called by API layer on behalf of user).
 */
export declare function writeAnswer(taskSlug: string, seq: number, answer: string): Promise<void>;
/**
 * Check whether the question deadline has passed (for TIMED_OUT detection).
 */
export declare function isQuestionTimedOut(taskSlug: string, seq: number): Promise<boolean>;
/**
 * Read the raw content of a question file (for API to extract question/deadline).
 * Returns null if the file does not exist.
 */
export declare function readQuestion(taskSlug: string, seq: number): Promise<string | null>;
//# sourceMappingURL=ipc-manager.d.ts.map