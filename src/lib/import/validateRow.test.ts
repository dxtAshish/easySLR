import { describe, expect, it } from "vitest";

import { validateImportRow } from "./validateRow";

describe("validateImportRow", () => {
  it("marks a row with no title as invalid", () => {
    const result = validateImportRow({ Title: "  ", PMID: "123" }, 1);
    expect(result.status).toBe("invalid");
    expect(result.reason).toMatch(/title/i);
    expect(result.data).toBeUndefined();
  });

  it("parses a well-formed PubMed-style row", () => {
    const result = validateImportRow(
      {
        PMID: "36000123",
        Title: "Statins and cardiovascular outcomes",
        Authors: "Doe J, Smith A",
        "First Author": "Doe J",
        "Journal/Book": "J Cardiol",
        "Publication Year": "2023",
        DOI: "10.1000/abc.2023",
      },
      2,
    );

    expect(result.status).toBe("valid");
    expect(result.data).toMatchObject({
      pmid: "36000123",
      title: "Statins and cardiovascular outcomes",
      firstAuthor: "Doe J",
      journal: "J Cardiol",
      pubYear: 2023,
      doi: "10.1000/abc.2023",
    });
    expect(result.warnings).toHaveLength(0);
  });

  it("downgrades a bad publication year to a warning instead of failing the row", () => {
    const result = validateImportRow(
      { Title: "Some article", "Publication Year": "not-a-year" },
      3,
    );

    expect(result.status).toBe("valid");
    expect(result.data?.pubYear).toBeUndefined();
    expect(result.warnings.some((w) => /year/i.test(w))).toBe(true);
  });

  it("is tolerant of header casing/punctuation differences", () => {
    const result = validateImportRow({ title: "Case-insensitive header", pmid: "1" }, 4);
    expect(result.status).toBe("valid");
    expect(result.data?.title).toBe("Case-insensitive header");
  });

  it("flags a non-numeric PMID as a warning but still imports it", () => {
    const result = validateImportRow({ Title: "Odd PMID", PMID: "PMC1234" }, 5);
    expect(result.status).toBe("valid");
    expect(result.data?.pmid).toBe("PMC1234");
    expect(result.warnings.some((w) => /pmid/i.test(w))).toBe(true);
  });

  it("parses a bare 'Create Date' string as the calendar date it names, regardless of server timezone", () => {
    // Regression test: `new Date("2024/03/18")` parses as *local* midnight,
    // and storing/serializing that (Postgres, JSON) happens in UTC — in any
    // timezone behind UTC the stored date silently shifts back a day. This
    // is the exact PubMed "Create Date" export format, so it isn't a corner
    // case; it's the common path.
    const result = validateImportRow({ Title: "Date parsing", "Create Date": "2024/03/18" }, 6);
    expect(result.status).toBe("valid");
    expect(result.data?.createDate?.getUTCFullYear()).toBe(2024);
    expect(result.data?.createDate?.getUTCMonth()).toBe(2); // 0-indexed: March
    expect(result.data?.createDate?.getUTCDate()).toBe(18);
    expect(result.warnings).toHaveLength(0);
  });

  it("downgrades an unparseable create date to a warning instead of failing the row", () => {
    const result = validateImportRow(
      { Title: "Bad date", "Create Date": "not-a-date" },
      7,
    );
    expect(result.status).toBe("valid");
    expect(result.data?.createDate).toBeUndefined();
    expect(result.warnings.some((w) => /create date/i.test(w))).toBe(true);
  });
});
