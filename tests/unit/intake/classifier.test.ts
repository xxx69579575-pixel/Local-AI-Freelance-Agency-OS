// Unit tests for intake/classifier.ts
// Covers: AC-03 (MVP feature structure), FeatureItem field validation
import { normalizeFeatures } from "../../../src/modules/intake/classifier";
import type { FeatureItem } from "../../../src/types/intake";

describe("normalizeFeatures", () => {
  it("AC-03: MVP features get M-prefixed IDs and priority=MVP", () => {
    const { mvp } = normalizeFeatures(
      [{ id: "M1", name: "Auth", description: "Login", priority: "MVP", phase: "1.1", complexity: "medium" }],
      [],
    );
    expect(mvp).toHaveLength(1);
    expect(mvp[0]!.priority).toBe("MVP");
    expect(mvp[0]!.id).toBe("M1");
  });

  it("AC-03: Nice-to-have features get N-prefixed IDs by default", () => {
    const { niceToHave } = normalizeFeatures([], [
      { name: "Dark mode", description: "", priority: "nice-to-have", phase: "2.1", complexity: "low" } as Partial<FeatureItem> as FeatureItem,
    ]);
    expect(niceToHave[0]!.id).toBe("N1");
    expect(niceToHave[0]!.priority).toBe("nice-to-have");
  });

  it("generates fallback ID when id is missing", () => {
    const input = [{ name: "Feature", description: "", priority: "MVP", phase: "1.1", complexity: "medium" }] as Partial<FeatureItem>[] as FeatureItem[];
    const { mvp } = normalizeFeatures(input, []);
    expect(mvp[0]!.id).toBe("M1");
  });

  it("clamps invalid phase to '1.1'", () => {
    const input = [{ id: "M1", name: "F", description: "", priority: "MVP", phase: "9.9", complexity: "medium" }] as Partial<FeatureItem>[] as FeatureItem[];
    const { mvp } = normalizeFeatures(input, []);
    expect(mvp[0]!.phase).toBe("1.1");
  });

  it("clamps invalid complexity to 'medium'", () => {
    const input = [{ id: "M1", name: "F", description: "", priority: "MVP", phase: "1.1", complexity: "extreme" }] as Partial<FeatureItem>[] as FeatureItem[];
    const { mvp } = normalizeFeatures(input, []);
    expect(mvp[0]!.complexity).toBe("medium");
  });

  it("handles null/undefined input gracefully", () => {
    const { mvp, niceToHave } = normalizeFeatures(null as unknown as FeatureItem[], undefined as unknown as FeatureItem[]);
    expect(mvp).toEqual([]);
    expect(niceToHave).toEqual([]);
  });

  it("preserves valid phase values across the full union", () => {
    const phases = ["1.1","1.2","1.3","1.4","2.1","2.2","2.3","2.4","2.5","3.1","3.2","4.1","4.2","5.x"] as FeatureItem["phase"][];
    for (const phase of phases) {
      const input = [{ id: "M1", name: "F", description: "", priority: "MVP", phase, complexity: "low" }] as FeatureItem[];
      const { mvp } = normalizeFeatures(input, []);
      expect(mvp[0]!.phase).toBe(phase);
    }
  });
});
