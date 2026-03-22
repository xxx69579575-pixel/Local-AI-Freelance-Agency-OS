// SDD module — Spec Gate validation (sdd-workflow.md § 3.2, § 4.4)
import { readFile, fileExists } from "../../utils/file-writer.js";
import { logger } from "../../utils/logger.js";
import { parseVersion, parseRequiredSections } from "./spec-parser.js";
import { getOpenIssues } from "./review-parser.js";
import { compareVersion } from "./version-manager.js";
import { CONFIG } from "../../config.js";
// Aliases that always force require_reviewed=true (§ 3.2 RV-021)
const IMPL_ALIASES = ["implement", "add-feature", "fix-bug"];
const REQUIRED_SECTION_COUNT = 5;
/**
 * Run the Spec Gate for a given spec slug.
 *
 * @param specSlug       e.g. "intake-module"
 * @param requireReviewed  Whether to check review file / open issues
 * @param callerAlias    If provided and is an impl alias, forces requireReviewed=true
 */
export async function runSpecGate(specSlug, requireReviewed = true, callerAlias) {
    const specPath = `${CONFIG.paths.specs}/${specSlug}.md`;
    const reviewPath = `${CONFIG.paths.specReviews}/${specSlug}-review.md`;
    const checks = [];
    // § 3.2 RV-021: impl aliases always force require_reviewed=true
    const effectiveRequireReviewed = callerAlias && IMPL_ALIASES.includes(callerAlias) ? true : requireReviewed;
    if (callerAlias && IMPL_ALIASES.includes(callerAlias) && !requireReviewed) {
        logger.warn("Spec Gate: require_reviewed=false ignored for impl alias", { callerAlias });
    }
    // Check 1: spec file exists
    const exists = await fileExists(specPath);
    checks.push({
        name: "file_exists",
        passed: exists,
        message: exists ? "OK" : `${specPath} not found`,
    });
    if (!exists) {
        return { passed: false, spec_path: specPath, version: "N/A", checks };
    }
    const content = await readFile(specPath) ?? "";
    const version = parseVersion(content);
    // Check 2: version ≥ v1.1 when review required
    const versionOk = effectiveRequireReviewed
        ? compareVersion(version, "v1.1") >= 0
        : true;
    checks.push({
        name: "version_reviewed",
        passed: versionOk,
        message: versionOk
            ? `${version} ≥ v1.1`
            : `${version} < v1.1. Run /dispatch "review-spec" then "update-spec" first.`,
    });
    // Check 3: all 5 required sections present
    const foundSections = parseRequiredSections(content);
    const sectionsOk = foundSections.length >= REQUIRED_SECTION_COUNT;
    const missingNums = Array.from({ length: REQUIRED_SECTION_COUNT }, (_, i) => String(i + 1)).filter((n) => !foundSections.includes(n));
    checks.push({
        name: "required_sections",
        passed: sectionsOk,
        message: sectionsOk
            ? `All ${REQUIRED_SECTION_COUNT} sections present`
            : `Missing sections: ${missingNums.join(", ")}`,
    });
    if (effectiveRequireReviewed) {
        // Check 4: review file must exist (RV-018)
        const reviewExists = await fileExists(reviewPath);
        checks.push({
            name: "review_file_exists",
            passed: reviewExists,
            message: reviewExists
                ? "review file found"
                : `${reviewPath} not found. Run /dispatch 'review-spec' first.`,
        });
        if (!reviewExists) {
            return { passed: false, spec_path: specPath, version, checks };
        }
        // Check 5: no OPEN issues in review file
        const reviewContent = await readFile(reviewPath) ?? "";
        const openIssues = getOpenIssues(reviewContent);
        const noOpenIssues = openIssues.length === 0;
        checks.push({
            name: "open_issues",
            passed: noOpenIssues,
            message: noOpenIssues
                ? "No open review issues"
                : `${openIssues.length} open issue(s): ${openIssues.map((i) => i.id).join(", ")}`,
        });
    }
    const passed = checks.every((c) => c.passed);
    return { passed, spec_path: specPath, version, checks };
}
//# sourceMappingURL=spec-gate.js.map