// Unit tests for intake/risk-analyzer.ts
// Covers: AC-04 (risk structure), severity validation
import { normalizeRisks } from "../../../src/modules/intake/risk-analyzer";
import type { RiskItem } from "../../../src/types/intake";

describe("normalizeRisks", () => {
  it("AC-04: valid risk items are preserved as-is", () => {
    const risks: RiskItem[] = [
      { id: "R1", description: "DB migration risk", severity: "high", mitigation: "Use blue-green deploy" },
    ];
    const result = normalizeRisks(risks);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(risks[0]);
  });

  it("AC-04: severity must be high/medium/low", () => {
    const risks = [{ id: "R1", description: "Risk", severity: "critical", mitigation: "Fix it" }] as Partial<RiskItem>[] as RiskItem[];
    const result = normalizeRisks(risks);
    expect(result[0]!.severity).toBe("medium"); // fallback
  });

  it("AC-04: missing id is auto-generated as R{n}", () => {
    const risks = [{ description: "Risk", severity: "low", mitigation: "None" }] as Partial<RiskItem>[] as RiskItem[];
    const result = normalizeRisks(risks);
    expect(result[0]!.id).toBe("R1");
  });

  it("AC-04: missing description gets default value", () => {
    const risks = [{ id: "R1", severity: "low", mitigation: "None" }] as Partial<RiskItem>[] as RiskItem[];
    const result = normalizeRisks(risks);
    expect(result[0]!.description).toBe("Unknown risk");
  });

  it("AC-04: missing mitigation gets default value", () => {
    const risks = [{ id: "R1", description: "Risk", severity: "high" }] as Partial<RiskItem>[] as RiskItem[];
    const result = normalizeRisks(risks);
    expect(result[0]!.mitigation).toBe("To be determined");
  });

  it("handles null input gracefully", () => {
    const result = normalizeRisks(null as unknown as RiskItem[]);
    expect(result).toEqual([]);
  });

  it("handles multiple risks, incrementing auto-IDs", () => {
    const risks = [
      { description: "R1", severity: "high", mitigation: "M1" },
      { description: "R2", severity: "low", mitigation: "M2" },
    ] as Partial<RiskItem>[] as RiskItem[];
    const result = normalizeRisks(risks);
    expect(result[0]!.id).toBe("R1");
    expect(result[1]!.id).toBe("R2");
  });
});
