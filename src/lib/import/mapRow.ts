/**
 * PubMed-style exports (and Excel re-saves of them) are inconsistent about
 * header casing/punctuation — "Journal/Book" vs "Journal", "NIHMS ID" vs
 * "NIHMSID". We normalize headers before matching so minor formatting
 * differences don't turn into "missing column" failures.
 */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const HEADER_ALIASES: Record<string, keyof RawMappedRow> = {
  pmid: "pmid",
  title: "title",
  authors: "authors",
  author: "authors",
  citation: "citation",
  firstauthor: "firstAuthor",
  journalbook: "journal",
  journal: "journal",
  publicationyear: "pubYear",
  pubyear: "pubYear",
  year: "pubYear",
  createdate: "createDate",
  datecreated: "createDate",
  pmcid: "pmcid",
  nihmsid: "nihmsId",
  doi: "doi",
};

export interface RawMappedRow {
  pmid?: unknown;
  title?: unknown;
  authors?: unknown;
  citation?: unknown;
  firstAuthor?: unknown;
  journal?: unknown;
  pubYear?: unknown;
  createDate?: unknown;
  pmcid?: unknown;
  nihmsId?: unknown;
  doi?: unknown;
}

/** Maps a raw spreadsheet row (arbitrary headers) onto our known fields. */
export function mapRawRow(raw: Record<string, unknown>): RawMappedRow {
  const mapped: RawMappedRow = {};
  for (const [header, value] of Object.entries(raw)) {
    const field = HEADER_ALIASES[normalizeHeader(header)];
    if (field) mapped[field] = value;
  }
  return mapped;
}
