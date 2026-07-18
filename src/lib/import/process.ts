import { applyDedupe } from "./dedupe";
import { type ImportRowResult, type ImportSummary } from "./types";
import { validateImportRow } from "./validateRow";

export { computeDedupeKeys } from "./dedupe";
export * from "./types";

/**
 * Full pipeline for a batch of raw spreadsheet rows: validate/coerce each
 * row, then dedupe against both the rest of the file and whatever the
 * project already contains. Used identically by the preview and commit tRPC
 * procedures so the preview a user sees is guaranteed to match what commit
 * will actually do (commit re-runs this rather than trusting client state).
 */
export function processImportRows(
  rawRows: Record<string, unknown>[],
  existingKeys: ReadonlySet<string>,
): ImportRowResult[] {
  const validated = rawRows.map((raw, index) =>
    validateImportRow(raw, index + 1),
  );
  return applyDedupe(validated, existingKeys);
}

export function summarizeResults(results: ImportRowResult[]): ImportSummary {
  return {
    totalRows: results.length,
    validRows: results.filter((r) => r.status === "valid").length,
    duplicateRows: results.filter((r) => r.status === "duplicate").length,
    invalidRows: results.filter((r) => r.status === "invalid").length,
  };
}
