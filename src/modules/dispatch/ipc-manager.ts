// Dispatch module — IPC question/answer file management (dispatch-module.md § 3.4, § 4.4)
import path from "node:path";
import { atomicWrite, readFile, fileExists } from "../../utils/file-writer.js";
import { CONFIG } from "../../config.js";
import { WaitingForInputError } from "../../utils/errors.js";
import type { IPCMessage } from "../../types/dispatch.js";

function ipcDir(taskSlug: string): string {
  return `${CONFIG.paths.dispatch}/${taskSlug}/ipc`;
}

function seqStr(seq: number): string {
  return String(seq).padStart(3, "0");
}

/**
 * Write a question file atomically, then throw WaitingForInputError.
 * The calling task-runner catches this and sets status = WAITING_INPUT.
 */
export async function askAndPause(
  taskSlug: string,
  seq: number,
  question: string,
  background: string,
  options?: string[],
): Promise<never> {
  const deadline = new Date(Date.now() + CONFIG.ipc.questionTimeoutMs).toISOString();
  const content = buildQuestionContent({ question, background, options, deadline });
  await atomicWrite(path.join(ipcDir(taskSlug), `${seqStr(seq)}.question`), content);
  throw new WaitingForInputError(seq);
}

/**
 * Check for a pending answer (single read, no polling).
 * Returns the answer text if found and non-empty, otherwise null.
 * On success, writes the .done marker.
 */
export async function checkPendingAnswer(
  taskSlug: string,
  seq: number,
): Promise<string | null> {
  const answerPath = path.join(ipcDir(taskSlug), `${seqStr(seq)}.answer`);
  if (!(await fileExists(answerPath))) return null;

  const content = await readFile(answerPath);
  if (!content || content.trim().length === 0) return null;

  const donePath = path.join(ipcDir(taskSlug), `${seqStr(seq)}.done`);
  await atomicWrite(donePath, new Date().toISOString());

  return content.trim();
}

/**
 * Atomically write an answer file (called by API layer on behalf of user).
 */
export async function writeAnswer(
  taskSlug: string,
  seq: number,
  answer: string,
): Promise<void> {
  if (answer.trim().length === 0) {
    throw new Error("answer cannot be empty");
  }
  await atomicWrite(path.join(ipcDir(taskSlug), `${seqStr(seq)}.answer`), answer);
}

/**
 * Check whether the question deadline has passed (for TIMED_OUT detection).
 */
export async function isQuestionTimedOut(
  taskSlug: string,
  seq: number,
): Promise<boolean> {
  const questionPath = path.join(ipcDir(taskSlug), `${seqStr(seq)}.question`);
  const content = await readFile(questionPath);
  if (!content) return false;

  const match = /\*\*等待截止\*\*：(.+)/.exec(content);
  if (!match || !match[1]) return false;

  return new Date() > new Date(match[1].trim());
}

/**
 * Read the raw content of a question file (for API to extract question/deadline).
 * Returns null if the file does not exist.
 */
export async function readQuestion(
  taskSlug: string,
  seq: number,
): Promise<string | null> {
  const questionPath = path.join(ipcDir(taskSlug), `${seqStr(seq)}.question`);
  return readFile(questionPath);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface QuestionContent {
  question: string;
  background: string;
  options?: string[];
  deadline: string;
}

function buildQuestionContent(msg: QuestionContent): string {
  const lines = [
    `**問題**：${msg.question}`,
    `**背景**：${msg.background}`,
  ];
  if (msg.options && msg.options.length > 0) {
    lines.push("**選項**：");
    msg.options.forEach((opt, i) => lines.push(`- ${String.fromCharCode(65 + i)}) ${opt}`));
  }
  lines.push(`**等待截止**：${msg.deadline}`);
  return lines.join("\n");
}
