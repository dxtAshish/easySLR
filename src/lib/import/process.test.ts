import { describe, expect, it } from "vitest";

import { computeDedupeKeys } from "./dedupe";
import { processImportRows, summarizeResults } from "./process";

describe("processImportRows", () => {
  it("flags in-file duplicates by PMID, keeping the first occurrence valid", () => {
    const rows = [
      { Title: "Article A", PMID: "111" },
      { Title: "Article A (reprint)", PMID: "111" },
    ];

    const results = processImportRows(rows, new Set());
    expect(results[0]?.status).toBe("valid");
    expect(results[1]?.status).toBe("duplicate");
    expect(results[1]?.reason).toMatch(/row 1/i);
  });

  it("falls back to title+first-author when neither PMID nor DOI is present", () => {
    const rows = [
      { Title: "Same Title Twice", "First Author": "Doe J" },
      { Title: "same title twice", "First Author": "doe j" },
    ];

    const results = processImportRows(rows, new Set());
    expect(results[1]?.status).toBe("duplicate");
  });

  it("flags rows that collide with an existing article in the project", () => {
    const existingKeys = new Set(computeDedupeKeys({ pmid: "999", title: "x" }));
    const rows = [{ Title: "Already imported", PMID: "999" }];

    const results = processImportRows(rows, existingKeys);
    expect(results[0]?.status).toBe("duplicate");
    expect(results[0]?.reason).toMatch(/already exists/i);
  });

  it("flags a row whose DOI matches an earlier row even when its PMID is unique", () => {
    // Regression test: PMID and DOI are independent unique constraints in
    // the database ([projectId, pmid] and [projectId, doi]). A row must be
    // treated as a duplicate if EITHER identifier collides — not just the
    // one that happens to be checked first — or a distinct-PMID/duplicate-DOI
    // row would sail through app-level dedupe as "valid" and then blow up
    // the whole import batch on the DB unique constraint at commit time.
    const rows = [
      { Title: "Original", PMID: "111", DOI: "10.1000/example.001" },
      { Title: "Duplicate DOI example", PMID: "222", DOI: "10.1000/example.001" },
    ];

    const results = processImportRows(rows, new Set());
    expect(results[0]?.status).toBe("valid");
    expect(results[1]?.status).toBe("duplicate");
    expect(results[1]?.reason).toMatch(/row 1/i);
  });

  it("flags a row whose PMID matches an earlier row even when its DOI is unique", () => {
    const rows = [
      { Title: "Original", PMID: "111", DOI: "10.1000/example.001" },
      { Title: "Duplicate PMID example", PMID: "111", DOI: "10.1000/example.002" },
    ];

    const results = processImportRows(rows, new Set());
    expect(results[0]?.status).toBe("valid");
    expect(results[1]?.status).toBe("duplicate");
  });

  it("does not let an invalid row collide with a duplicate check", () => {
    const rows = [{ Title: "" }, { Title: "Valid one", PMID: "1" }];
    const results = processImportRows(rows, new Set());
    expect(results[0]?.status).toBe("invalid");
    expect(results[1]?.status).toBe("valid");
  });

  it("summarizes a mixed batch correctly", () => {
    const rows = [
      { Title: "" }, // invalid
      { Title: "Valid A", PMID: "1" }, // valid
      { Title: "Valid A dup", PMID: "1" }, // duplicate (in-file)
    ];
    const summary = summarizeResults(processImportRows(rows, new Set()));
    expect(summary).toEqual({
      totalRows: 3,
      validRows: 1,
      duplicateRows: 1,
      invalidRows: 1,
    });
  });
});
