type CsvPrimitive = string | number | boolean | Date | null | undefined;

function escapeCsvCell(value: CsvPrimitive): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Builds an RFC 4180-ish CSV string from column definitions + rows. */
export function buildCsv<T>(
  columns: { header: string; value: (row: T) => CsvPrimitive }[],
  rows: T[],
): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.value(row))).join(","),
  );
  return [header, ...lines].join("\r\n");
}
