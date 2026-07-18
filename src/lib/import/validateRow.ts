import { mapRawRow } from "./mapRow";
import { type ImportRowResult } from "./types";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1500;

function toPrimitiveString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function toTrimmedString(value: unknown): string | undefined {
  const str = toPrimitiveString(value)?.trim();
  return str && str.length > 0 ? str : undefined;
}

function toYear(value: unknown): { year?: number; warning?: string } {
  if (value === null || value === undefined || value === "") return {};

  if (value instanceof Date) return { year: value.getFullYear() };

  if (typeof value === "number") {
    if (value < MIN_YEAR || value > CURRENT_YEAR + 1) {
      return { warning: `Publication year ${value} looks out of range — left blank.` };
    }
    return { year: value };
  }

  if (typeof value === "string") {
    const parsed = parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed)) {
      return { warning: `Publication year "${value}" is not a number — left blank.` };
    }
    if (parsed < MIN_YEAR || parsed > CURRENT_YEAR + 1) {
      return { warning: `Publication year ${parsed} looks out of range — left blank.` };
    }
    return { year: parsed };
  }

  return { warning: "Publication year is in an unrecognized format — left blank." };
}

/**
 * Parses a bare calendar date like "2024/03/18" or "2024-03-18" as UTC
 * midnight. `new Date(string)` is timezone-dependent for slash-separated
 * dates specifically — the spec has it parse as *local* midnight, while
 * storage/serialization (Postgres, JSON, `toISOString`) happens in UTC. In
 * any timezone behind UTC that silently shifts the date back by one day.
 * PubMed's "Create Date" export column uses exactly this bare YYYY/MM/DD
 * format, so this isn't a hypothetical — explicit UTC construction is
 * required to store the date the source file actually says.
 */
function parseDateOnly(str: string): Date | undefined {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(str.trim());
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return roundTrips ? date : undefined;
}

function toDate(value: unknown): { date?: Date; warning?: string } {
  if (value === null || value === undefined || value === "") return {};

  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return { warning: "Create date could not be parsed — left blank." };
    }
    return { date: value };
  }

  if (typeof value === "string") {
    const dateOnly = parseDateOnly(value);
    if (dateOnly) return { date: dateOnly };
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      return { warning: `Create date "${value}" could not be parsed — left blank.` };
    }
    return { date: parsed };
  }

  return { warning: "Create date is in an unrecognized format — left blank." };
}

/**
 * Validates + coerces a single raw spreadsheet row.
 *
 * Design choice: the only *hard* failure is a missing title — a row with no
 * title isn't a usable article record. Everything else (bad year, bad date,
 * odd PMID format) is best-effort coerced and downgraded to a warning so one
 * malformed cell doesn't throw away an otherwise-good row. Warnings are
 * surfaced in the import preview so the user can decide whether to fix the
 * source file and re-import.
 */
export function validateImportRow(
  raw: Record<string, unknown>,
  rowNumber: number,
): ImportRowResult {
  const mapped = mapRawRow(raw);
  const warnings: string[] = [];

  const title = toTrimmedString(mapped.title);
  if (!title) {
    return {
      rowNumber,
      status: "invalid",
      warnings,
      reason: "Missing required field: Title.",
      raw,
    };
  }

  const yearResult = toYear(mapped.pubYear);
  if (yearResult.warning) warnings.push(yearResult.warning);

  const dateResult = toDate(mapped.createDate);
  if (dateResult.warning) warnings.push(dateResult.warning);

  const pmid = toTrimmedString(mapped.pmid);
  if (pmid && !/^\d+$/.test(pmid)) {
    warnings.push(`PMID "${pmid}" is not purely numeric — stored as-is.`);
  }

  return {
    rowNumber,
    status: "valid",
    warnings,
    raw,
    data: {
      title,
      pmid,
      doi: toTrimmedString(mapped.doi),
      authors: toTrimmedString(mapped.authors),
      citation: toTrimmedString(mapped.citation),
      firstAuthor: toTrimmedString(mapped.firstAuthor),
      journal: toTrimmedString(mapped.journal),
      pmcid: toTrimmedString(mapped.pmcid),
      nihmsId: toTrimmedString(mapped.nihmsId),
      pubYear: yearResult.year,
      createDate: dateResult.date,
    },
  };
}
