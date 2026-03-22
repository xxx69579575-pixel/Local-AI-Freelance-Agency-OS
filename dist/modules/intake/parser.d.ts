import type { IntakeInput, IntakeOutput } from "../../types/intake.js";
/**
 * Run the full intake flow:
 *   1. Call AI to analyse requirements (with retry)
 *   2. Normalise and validate the AI output
 *   3. Generate and write the intake document (overwrite if same slug exists — AC-06)
 */
export declare function runIntake(input: IntakeInput, intakeDir?: string): Promise<{
    outputPath: string;
    output: IntakeOutput;
}>;
//# sourceMappingURL=parser.d.ts.map