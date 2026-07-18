import { type ImportRowResult, type ValidatedArticleData } from "./types";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

type DedupeSource = Pick<ValidatedArticleData, "pmid" | "doi" | "title" | "firstAuthor">;

/**
 * A row can collide on PMID *or* DOI independently — the database enforces
 * both as separate unique constraints (`[projectId, pmid]` and
 * `[projectId, doi]`), so application-level dedupe has to check both rather
 * than picking one "preferred" identifier and ignoring the other. A row
 * with a fresh PMID but a DOI that's already been used (or vice versa) is
 * still a duplicate. Only when a row has *neither* identifier do we fall
 * back to a normalized title+first-author match — good enough to catch
 * obvious re-imports without being so fuzzy it collapses distinct articles
 * that merely share a title.
 */
export function computeDedupeKeys(data: DedupeSource): string[] {
  const keys: string[] = [];
  if (data.pmid) keys.push(`pmid:${data.pmid}`);
  if (data.doi) keys.push(`doi:${data.doi.toLowerCase().trim()}`);
  if (keys.length === 0) {
    keys.push(`title:${normalizeTitle(data.title)}|${normalizeTitle(data.firstAuthor ?? "")}`);
  }
  return keys;
}

/**
 * Marks "valid" rows as "duplicate" when any of their dedupe keys collide
 * with either an earlier row in the same file or an article already in the
 * project. First occurrence of a given key wins; later ones are flagged.
 */
export function applyDedupe(
  rows: ImportRowResult[],
  existingKeys: ReadonlySet<string>,
): ImportRowResult[] {
  const seenInFile = new Map<string, number>();

  return rows.map((row) => {
    if (row.status !== "valid" || !row.data) return row;

    const keys = computeDedupeKeys(row.data);

    if (keys.some((key) => existingKeys.has(key))) {
      return {
        ...row,
        status: "duplicate",
        reason: "Already exists in this project.",
      };
    }

    const matchedRow = keys
      .map((key) => seenInFile.get(key))
      .find((rowNumber) => rowNumber !== undefined);
    if (matchedRow !== undefined) {
      return {
        ...row,
        status: "duplicate",
        reason: `Duplicate of row ${matchedRow} in this file.`,
      };
    }

    for (const key of keys) seenInFile.set(key, row.rowNumber);
    return row;
  });
}
