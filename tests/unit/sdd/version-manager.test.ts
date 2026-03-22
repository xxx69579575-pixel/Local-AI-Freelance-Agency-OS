// Unit tests for sdd/version-manager.ts
import {
  parseVersionParts,
  compareVersion,
  incrementMinorVersion,
  incrementMajorVersion,
  replaceVersion,
  appendChangelog,
} from "../../../src/modules/sdd/version-manager";

describe("parseVersionParts", () => {
  it("parses v1.0", () => expect(parseVersionParts("v1.0")).toEqual([1, 0]));
  it("parses v1.1", () => expect(parseVersionParts("v1.1")).toEqual([1, 1]));
  it("parses v2.0", () => expect(parseVersionParts("v2.0")).toEqual([2, 0]));
  it("returns [1,0] for invalid", () => expect(parseVersionParts("bad")).toEqual([1, 0]));
});

describe("compareVersion", () => {
  it("v1.1 > v1.0", () => expect(compareVersion("v1.1", "v1.0")).toBeGreaterThan(0));
  it("v1.0 < v1.1", () => expect(compareVersion("v1.0", "v1.1")).toBeLessThan(0));
  it("v1.1 === v1.1", () => expect(compareVersion("v1.1", "v1.1")).toBe(0));
  it("v2.0 > v1.9", () => expect(compareVersion("v2.0", "v1.9")).toBeGreaterThan(0));
});

describe("incrementMinorVersion", () => {
  it("AC-06: v1.0 → v1.1", () => expect(incrementMinorVersion("v1.0")).toBe("v1.1"));
  it("v1.2 → v1.3", () => expect(incrementMinorVersion("v1.2")).toBe("v1.3"));
  it("v2.5 → v2.6", () => expect(incrementMinorVersion("v2.5")).toBe("v2.6"));
});

describe("incrementMajorVersion", () => {
  it("v1.3 → v2.0", () => expect(incrementMajorVersion("v1.3")).toBe("v2.0"));
});

describe("replaceVersion", () => {
  it("replaces version in spec content", () => {
    const content = "> **文件版本**：v1.0\nother content";
    expect(replaceVersion(content, "v1.1")).toContain("v1.1");
    expect(replaceVersion(content, "v1.1")).not.toContain("v1.0");
  });
});

describe("appendChangelog", () => {
  it("AC-06: appends changelog entry to existing section", () => {
    const content = "# Spec\n\n## Changelog\n\n### v1.0 — 2026-01-01\n- Initial\n";
    const updated = appendChangelog(content, "v1.1", "2026-03-22", ["Fixed issue RV-001"]);
    expect(updated).toContain("### v1.1 — 2026-03-22");
    expect(updated).toContain("Fixed issue RV-001");
    expect(updated).toContain("### v1.0");
  });

  it("creates Changelog section when none exists", () => {
    const content = "# Spec\n\nSome content";
    const updated = appendChangelog(content, "v1.1", "2026-03-22", ["Added feature"]);
    expect(updated).toContain("## Changelog");
    expect(updated).toContain("### v1.1");
  });
});
