// SDD module — public exports
export { runSpecGate } from "./spec-gate.js";
export { runDriftCheck } from "./drift-checker.js";
export { handleSddRequest } from "./api.js";
export { parseVersion, parseRequiredSections, parseAcceptanceCriteria } from "./spec-parser.js";
export { parseIssues, getOpenIssues } from "./review-parser.js";
export { compareVersion, incrementMinorVersion, incrementMajorVersion, replaceVersion, appendChangelog } from "./version-manager.js";
//# sourceMappingURL=index.js.map