// SDD module — REST API routes (sdd-workflow.md § 4.2)
import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileExists, readFile } from "../../utils/file-writer.js";
import { logger } from "../../utils/logger.js";
import { CONFIG } from "../../config.js";
import { runSpecGate } from "./spec-gate.js";
import { runDriftCheck } from "./drift-checker.js";
import { parseVersion, parseRequiredSections } from "./spec-parser.js";
import { parseIssues, getOpenIssues } from "./review-parser.js";

// ---------------------------------------------------------------------------
// SDDPhaseStatus
// ---------------------------------------------------------------------------

interface SDDPhaseStatus {
  phase: string;
  status: "not_started" | "in_progress" | "done" | "blocked";
  input_ready: boolean;
  output_path?: string;
  blocked_by?: string;
}

const PHASE_ORDER = [
  "1.1", "1.2", "1.3", "1.4",
  "2.1", "2.2", "2.3", "2.4", "2.5",
  "3.1", "3.2",
  "4.1", "4.2",
  "5.x",
];

/** Derive current_phase from a list of phase statuses (§ 4.4 RV-022). */
function deriveCurrentPhase(phases: SDDPhaseStatus[]): string {
  const inProgress = phases.filter((p) => p.status === "in_progress");
  if (inProgress.length > 0) {
    return inProgress.sort(
      (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase),
    )[0].phase;
  }
  const done = phases.filter((p) => p.status === "done");
  if (done.length === 0) return "1.1";
  const lastDone = done.sort(
    (a, b) => PHASE_ORDER.indexOf(b.phase) - PHASE_ORDER.indexOf(a.phase),
  )[0];
  const nextIdx = PHASE_ORDER.indexOf(lastDone.phase) + 1;
  return nextIdx < PHASE_ORDER.length ? PHASE_ORDER[nextIdx] : lastDone.phase;
}

/** Compute SDD phase statuses by inspecting the docs/ directory. */
async function computePhaseStatuses(): Promise<SDDPhaseStatus[]> {
  const intakeExists = await anyFileExists(CONFIG.paths.intake, ".md");
  const specsExist = await anyFileExists(CONFIG.paths.specs, ".md");
  const reviewsExist = await anyFileExists(CONFIG.paths.specReviews, ".md");
  const srcExists = await fileExists(CONFIG.paths.src);
  const testsExist = await fileExists(CONFIG.paths.tests);
  const docsReviewsExist = await anyFileExists("docs/reviews", ".md");
  const docsQAExist = await anyFileExists("docs/qa", ".md");
  const vercelDeployed = await fileExists(".vercel");

  return [
    {
      phase: "1.1",
      status: intakeExists ? "done" : "not_started",
      input_ready: true,
      output_path: intakeExists ? CONFIG.paths.intake : undefined,
    },
    {
      phase: "1.2",
      status: specsExist ? "done" : intakeExists ? "in_progress" : "not_started",
      input_ready: intakeExists,
      output_path: specsExist ? CONFIG.paths.specs : undefined,
    },
    {
      phase: "1.3",
      status: reviewsExist ? "done" : specsExist ? "in_progress" : "not_started",
      input_ready: specsExist,
      output_path: reviewsExist ? CONFIG.paths.specReviews : undefined,
    },
    {
      phase: "1.4",
      status: reviewsExist && specsExist ? "done" : reviewsExist ? "in_progress" : "not_started",
      input_ready: reviewsExist,
    },
    {
      phase: "2.1",
      status: srcExists ? "done" : "not_started",
      input_ready: specsExist,
      output_path: srcExists ? CONFIG.paths.src : undefined,
    },
    {
      phase: "2.2",
      status: srcExists ? "done" : "not_started",
      input_ready: srcExists,
    },
    {
      phase: "2.3",
      status: srcExists ? "done" : "not_started",
      input_ready: srcExists,
    },
    {
      phase: "2.4",
      status: testsExist ? "done" : "not_started",
      input_ready: srcExists,
      output_path: testsExist ? CONFIG.paths.tests : undefined,
    },
    {
      phase: "2.5",
      status: testsExist ? "done" : "not_started",
      input_ready: testsExist,
    },
    {
      phase: "3.1",
      status: docsReviewsExist ? "done" : "not_started",
      input_ready: srcExists,
      output_path: docsReviewsExist ? "docs/reviews" : undefined,
    },
    {
      phase: "3.2",
      status: docsQAExist ? "done" : "not_started",
      input_ready: srcExists,
      output_path: docsQAExist ? "docs/qa" : undefined,
    },
    {
      phase: "4.1",
      status: "done",
      input_ready: true,
    },
    {
      phase: "4.2",
      status: vercelDeployed ? "done" : "not_started",
      input_ready: true,
    },
    {
      phase: "5.x",
      status: "in_progress",
      input_ready: true,
    },
  ];
}

async function anyFileExists(dir: string, ext: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.some((e) => String(e).endsWith(ext));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Spec list helper
// ---------------------------------------------------------------------------

interface SpecSummary {
  slug: string;
  version: string;
  sections_complete: boolean;
  review_status: "not_reviewed" | "has_open_issues" | "all_resolved";
  spec_gate_ready: boolean;
}

async function buildSpecSummaries(statusFilter?: string): Promise<SpecSummary[]> {
  const summaries: SpecSummary[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(CONFIG.paths.specs);
  } catch {
    return summaries;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md") || entry === "review") continue;
    const slug = entry.replace(/\.md$/, "");
    const specPath = path.join(CONFIG.paths.specs, entry);
    const content = await readFile(specPath) ?? "";
    const version = parseVersion(content);
    const sections = parseRequiredSections(content);
    const sectionsComplete = sections.length >= 5;

    const reviewPath = path.join(CONFIG.paths.specReviews, `${slug}-review.md`);
    const reviewExists = await fileExists(reviewPath);
    let reviewStatus: SpecSummary["review_status"] = "not_reviewed";
    if (reviewExists) {
      const reviewContent = await readFile(reviewPath) ?? "";
      reviewStatus = getOpenIssues(reviewContent).length === 0 ? "all_resolved" : "has_open_issues";
    }

    const specGateReady = sectionsComplete && reviewStatus === "all_resolved";

    if (statusFilter && statusFilter !== reviewStatus) continue;
    summaries.push({ slug, version, sections_complete: sectionsComplete, review_status: reviewStatus, spec_gate_ready: specGateReady });
  }
  return summaries;
}

// ---------------------------------------------------------------------------
// HTTP utilities (reuse pattern from dispatch/api.ts)
// ---------------------------------------------------------------------------

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => {
      try { resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {}); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Handle /api/sdd/* routes.
 * Returns true if the request was handled, false if it should fall through.
 */
export async function handleSddRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  // POST /api/sdd/spec-gate
  if (method === "POST" && url === "/api/sdd/spec-gate") {
    try {
      const body = await readBody(req);
      const specSlug = body["spec_slug"];
      if (typeof specSlug !== "string" || specSlug.trim().length === 0) {
        send(res, 400, { error: "spec_slug is required" });
        return true;
      }
      const requireReviewed = body["require_reviewed"] !== false;
      const callerAlias = typeof body["caller_alias"] === "string" ? body["caller_alias"] : undefined;
      const result = await runSpecGate(specSlug.trim(), requireReviewed, callerAlias);
      send(res, 200, result);
    } catch (err) {
      logger.error("spec-gate error", { error: (err as Error).message });
      send(res, 500, { error: "Internal server error" });
    }
    return true;
  }

  // GET /api/sdd/status
  if (method === "GET" && url === "/api/sdd/status") {
    try {
      const phases = await computePhaseStatuses();
      const currentPhase = deriveCurrentPhase(phases);
      const blockedPhases = phases.filter((p) => p.status === "blocked").map((p) => p.phase);
      const completablePhases = phases
        .filter((p) => p.status === "not_started" && p.input_ready)
        .map((p) => p.phase);
      send(res, 200, { phases, current_phase: currentPhase, blocked_phases: blockedPhases, completable_phases: completablePhases });
    } catch (err) {
      logger.error("sdd status error", { error: (err as Error).message });
      send(res, 500, { error: "Internal server error" });
    }
    return true;
  }

  // GET /api/sdd/specs
  if (method === "GET" && (url === "/api/sdd/specs" || url.startsWith("/api/sdd/specs?"))) {
    try {
      const urlObj = new URL(url, "http://localhost");
      const statusFilter = urlObj.searchParams.get("status") ?? undefined;
      const specs = await buildSpecSummaries(statusFilter);
      send(res, 200, { specs });
    } catch (err) {
      logger.error("sdd specs error", { error: (err as Error).message });
      send(res, 500, { error: "Internal server error" });
    }
    return true;
  }

  // POST /api/sdd/drift-check
  if (method === "POST" && url === "/api/sdd/drift-check") {
    try {
      const body = await readBody(req);
      const specSlug = body["spec_slug"];
      const implPath = body["impl_path"];
      if (typeof specSlug !== "string" || specSlug.trim().length === 0) {
        send(res, 400, { error: "spec_slug is required" });
        return true;
      }
      if (typeof implPath !== "string" || implPath.trim().length === 0) {
        send(res, 400, { error: "impl_path is required" });
        return true;
      }
      const result = await runDriftCheck(specSlug.trim(), implPath.trim());
      send(res, 200, result);
    } catch (err) {
      logger.error("drift-check error", { error: (err as Error).message });
      send(res, 500, { error: "Internal server error" });
    }
    return true;
  }

  return false;
}
