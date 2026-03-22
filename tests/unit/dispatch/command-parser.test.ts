// Unit tests for dispatch/command-parser.ts
import { jest } from "@jest/globals";

const mockFileExists = jest.fn<(p: string) => Promise<boolean>>();

jest.unstable_mockModule("../../../src/utils/file-writer.js", () => ({
  fileExists: mockFileExists,
  writeFile: jest.fn(),
  atomicWrite: jest.fn(),
  readFile: jest.fn(),
}));

jest.unstable_mockModule("../../../src/config.js", () => ({
  CONFIG: { paths: { dispatch: ".dispatch/tasks" } },
  DISPATCH_ALIASES: [
    "intake","write-spec","review-spec","update-spec","implement",
    "add-feature","fix-bug","write-tests","code-review","qa-check",
    "security-audit","deploy-vercel","summarize",
  ],
}));

const { parseDispatchCommand, resolveTaskSlug } =
  await import("../../../src/modules/dispatch/command-parser.js");
const { InvalidAliasError } = await import("../../../src/utils/errors.js");

beforeEach(() => {
  mockFileExists.mockReset();
  mockFileExists.mockResolvedValue(false);
});

describe("parseDispatchCommand", () => {
  it("parses alias-only command", () => {
    const cmd = parseDispatchCommand("review-spec");
    expect(cmd.alias).toBe("review-spec");
    expect(cmd.context).toBe("");
    expect(cmd.model).toBe("sonnet");
  });

  it("parses 'alias: context' format", () => {
    const cmd = parseDispatchCommand("write-spec: agency-os");
    expect(cmd.alias).toBe("write-spec");
    expect(cmd.context).toBe("agency-os");
    expect(cmd.model).toBe("opus");
  });

  it("trims whitespace from alias and context", () => {
    const cmd = parseDispatchCommand("  implement :  src/modules  ");
    expect(cmd.alias).toBe("implement");
    expect(cmd.context).toBe("src/modules");
  });

  it("AC-08: throws InvalidAliasError for unknown alias", () => {
    expect(() => parseDispatchCommand("unknown-alias")).toThrow(InvalidAliasError);
  });

  it("AC-08: error message includes valid alias list", () => {
    expect.assertions(2);
    try { parseDispatchCommand("bad-alias"); } catch (err) {
      expect(err).toBeInstanceOf(InvalidAliasError);
      expect((err as Error).message).toContain("write-spec");
    }
  });

  it("returns correct model for aliases", () => {
    expect(parseDispatchCommand("intake").model).toBe("opus");
    expect(parseDispatchCommand("write-spec").model).toBe("opus");
    expect(parseDispatchCommand("implement").model).toBe("sonnet");
    expect(parseDispatchCommand("summarize").model).toBe("sonnet");
  });
});

describe("resolveTaskSlug", () => {
  it("returns alias slug when no context", async () => {
    expect(await resolveTaskSlug(parseDispatchCommand("review-spec"))).toBe("review-spec");
  });
  it("returns alias-context-kebab slug", async () => {
    expect(await resolveTaskSlug(parseDispatchCommand("write-spec: agency-os"))).toBe("write-spec-agency-os");
  });
  it("removes CJK from context", async () => {
    expect(await resolveTaskSlug(parseDispatchCommand("intake: React 電商"))).toBe("intake-react");
  });
});
