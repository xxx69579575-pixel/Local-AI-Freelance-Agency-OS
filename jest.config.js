/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    // Strip .js extensions from relative imports so ts-jest can resolve .ts files
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true, diagnostics: false }],
  },
  testMatch: ["**/tests/**/*.test.ts"],
  collectCoverageFrom: [
    "src/modules/intake/**/*.ts",
    "src/modules/dispatch/**/*.ts",
    "src/utils/**/*.ts",
    "!src/**/*.d.ts",
  ],
};
