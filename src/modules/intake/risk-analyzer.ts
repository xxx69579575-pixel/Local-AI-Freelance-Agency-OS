// Intake module — technical risk analyzer
// Validates and normalizes risk items returned from AI analysis
import type { RiskItem } from "../../types/intake.js";

const VALID_SEVERITIES = ["high", "medium", "low"] as const;

/**
 * Validate and normalize risk items from AI output.
 * Ensures all required fields are present and severity is within allowed enum.
 */
export function normalizeRisks(risks: RiskItem[]): RiskItem[] {
  return (risks ?? []).map((r, i) => normalizeRisk(r, i));
}

function normalizeRisk(r: Partial<RiskItem>, index: number): RiskItem {
  return {
    id: typeof r.id === "string" && r.id.length > 0 ? r.id : `R${index + 1}`,
    description:
      typeof r.description === "string" && r.description.length > 0
        ? r.description
        : "Unknown risk",
    severity: VALID_SEVERITIES.includes(r.severity as RiskItem["severity"])
      ? (r.severity as RiskItem["severity"])
      : "medium",
    mitigation:
      typeof r.mitigation === "string" && r.mitigation.length > 0
        ? r.mitigation
        : "To be determined",
  };
}
