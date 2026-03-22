// Intake module — public API
export { runIntake } from "./parser.js";
export { normalizeFeatures } from "./classifier.js";
export { normalizeRisks } from "./risk-analyzer.js";
export { createIntakeServer } from "./api.js";
export type { IntakeInput, IntakeOutput } from "../../types/intake.js";
