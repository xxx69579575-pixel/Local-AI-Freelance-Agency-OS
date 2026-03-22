// Unit tests for utils/slug.ts
import { jest } from "@jest/globals";

const mockFileExists = jest.fn<(p: string) => Promise<boolean>>();

jest.unstable_mockModule("../../../src/utils/file-writer.js", () => ({
  fileExists: mockFileExists,
  writeFile: jest.fn(),
  atomicWrite: jest.fn(),
  readFile: jest.fn(),
}));

const {
  buildIntakeSlug,
  resolveIntakeSlug,
  buildDispatchSlug,
  resolveDispatchSlug,
} = await import("../../../src/utils/slug.js");

beforeEach(() => {
  mockFileExists.mockReset();
  mockFileExists.mockResolvedValue(false);
});

describe("buildIntakeSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(buildIntakeSlug("My Project")).toBe("my-project");
  });
  it("removes non-ASCII (CJK) characters", () => {
    expect(buildIntakeSlug("React App 電商")).toBe("react-app");
  });
  it("replaces special chars with hyphens", () => {
    expect(buildIntakeSlug("React App 2.0")).toBe("react-app-2-0");
  });
  it("collapses consecutive hyphens", () => {
    expect(buildIntakeSlug("foo--bar")).toBe("foo-bar");
  });
  it("trims leading and trailing hyphens", () => {
    expect(buildIntakeSlug("-my-project-")).toBe("my-project");
  });
  it("UUID fallback when result is empty (all CJK)", () => {
    expect(buildIntakeSlug("電商平台")).toMatch(/^proj-[a-f0-9]{8}$/);
  });
  it("UUID fallback for all non-ASCII", () => {
    expect(buildIntakeSlug("项目名称")).toMatch(/^proj-[a-f0-9]{8}$/);
  });
});

describe("resolveIntakeSlug", () => {
  it("returns baseSlug when no collision", async () => {
    mockFileExists.mockResolvedValue(false);
    expect(await resolveIntakeSlug("my-project", "docs/intake")).toBe("my-project");
  });
  it("returns -2 when base slug exists", async () => {
    mockFileExists.mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await resolveIntakeSlug("my-project", "docs/intake")).toBe("my-project-2");
  });
  it("increments to -3 when -2 also collides", async () => {
    mockFileExists.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await resolveIntakeSlug("my-project", "docs/intake")).toBe("my-project-3");
  });
});

describe("buildDispatchSlug", () => {
  it("alias + ASCII context → alias-context-kebab", () => {
    expect(buildDispatchSlug("write-spec", "agency-os")).toBe("write-spec-agency-os");
  });
  it("removes CJK from context, fallback to alias-only", () => {
    expect(buildDispatchSlug("intake", "電商平台")).toBe("intake");
  });
  it("partial CJK → removes CJK, keeps ASCII", () => {
    expect(buildDispatchSlug("intake", "React 電商")).toBe("intake-react");
  });
  it("empty context → alias only", () => {
    expect(buildDispatchSlug("review-spec", "")).toBe("review-spec");
  });
  it("special chars replaced with hyphens", () => {
    expect(buildDispatchSlug("implement", "feat/login")).toBe("implement-feat-login");
  });
});

describe("resolveDispatchSlug", () => {
  it("returns baseSlug when no collision", async () => {
    mockFileExists.mockResolvedValue(false);
    expect(await resolveDispatchSlug("write-spec-agency-os", ".dispatch/tasks")).toBe("write-spec-agency-os");
  });
  it("appends timestamp on collision", async () => {
    mockFileExists.mockResolvedValueOnce(true);
    const slug = await resolveDispatchSlug("write-spec-agency-os", ".dispatch/tasks");
    expect(slug).toMatch(/^write-spec-agency-os-\d{12}$/);
  });
});
