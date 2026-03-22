// Dispatch module — alias registry (dispatch-module.md § 3.6)
import { DISPATCH_ALIASES, type DispatchAlias } from "../../config.js";
import { InvalidAliasError } from "../../utils/errors.js";
import type { AliasEntry } from "../../types/dispatch.js";

const REGISTRY: Record<DispatchAlias, AliasEntry> = {
  intake: {
    alias: "intake",
    model: "opus",
    templatePath: ".dispatch/templates/intake-plan.md",
    outputPath: "docs/intake",
  },
  "write-spec": {
    alias: "write-spec",
    model: "opus",
    templatePath: ".dispatch/templates/write-spec-plan.md",
    outputPath: "docs/specs",
  },
  "review-spec": {
    alias: "review-spec",
    model: "sonnet",
    templatePath: ".dispatch/templates/review-spec-plan.md",
    outputPath: "docs/specs/review",
  },
  "update-spec": {
    alias: "update-spec",
    model: "sonnet",
    templatePath: ".dispatch/templates/update-spec-plan.md",
    outputPath: "docs/specs",
  },
  implement: {
    alias: "implement",
    model: "sonnet",
    templatePath: ".dispatch/templates/implement-plan.md",
    outputPath: "src",
  },
  "add-feature": {
    alias: "add-feature",
    model: "sonnet",
    templatePath: ".dispatch/templates/add-feature-plan.md",
    outputPath: "src",
  },
  "fix-bug": {
    alias: "fix-bug",
    model: "sonnet",
    templatePath: ".dispatch/templates/fix-bug-plan.md",
    outputPath: "src",
  },
  "write-tests": {
    alias: "write-tests",
    model: "sonnet",
    templatePath: ".dispatch/templates/write-tests-plan.md",
    outputPath: "tests",
  },
  "code-review": {
    alias: "code-review",
    model: "opus",
    templatePath: ".dispatch/templates/code-review-plan.md",
    outputPath: "docs/reviews",
  },
  "qa-check": {
    alias: "qa-check",
    model: "sonnet",
    templatePath: ".dispatch/templates/qa-check-plan.md",
    outputPath: "docs/qa",
  },
  "security-audit": {
    alias: "security-audit",
    model: "opus",
    templatePath: ".dispatch/templates/security-plan.md",
    outputPath: "docs/security",
  },
  "deploy-vercel": {
    alias: "deploy-vercel",
    model: "sonnet",
    templatePath: ".dispatch/templates/deploy-vercel-plan.md",
    outputPath: "",
  },
  summarize: {
    alias: "summarize",
    model: "sonnet",
    templatePath: ".dispatch/templates/summarize-plan.md",
    outputPath: "docs",
  },
};

export function getAliasEntry(alias: string): AliasEntry {
  if (!DISPATCH_ALIASES.includes(alias as DispatchAlias)) {
    throw new InvalidAliasError(alias, [...DISPATCH_ALIASES]);
  }
  return REGISTRY[alias as DispatchAlias];
}

export function isValidAlias(alias: string): alias is DispatchAlias {
  return DISPATCH_ALIASES.includes(alias as DispatchAlias);
}

export function validateDispatchAlias(alias: string): string {
  return isValidAlias(alias) ? alias : "write-spec";
}
