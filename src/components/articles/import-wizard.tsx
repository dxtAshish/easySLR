"use client";

import { useRef, useState } from "react";
import { read, utils } from "xlsx";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/trpc/react";

type PreviewResult = ReturnType<typeof api.import.preview.useMutation>["data"];
type RowResult = NonNullable<PreviewResult>["results"][number];

const STATUS_TONE = { valid: "green", duplicate: "amber", invalid: "red" } as const;

function rawTitle(raw: Record<string, unknown>): string {
  const value = raw.Title ?? raw.title;
  return typeof value === "string" || typeof value === "number" ? String(value) : "—";
}

export function ImportWizard({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const utilsApi = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<{ inserted: number; skipped: number } | null>(null);

  const preview = api.import.preview.useMutation();
  const commit = api.import.commit.useMutation({
    onSuccess: async (result) => {
      setCommitted({
        inserted: result.summary.validRows,
        skipped: result.summary.duplicateRows + result.summary.invalidRows,
      });
      await utilsApi.article.list.invalidate();
      await utilsApi.project.stats.invalidate();
      await utilsApi.article.labels.invalidate();
    },
  });

  const reset = () => {
    setFileName(null);
    setRows(null);
    setParseError(null);
    setCommitted(null);
    preview.reset();
    commit.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("The workbook has no sheets.");
      const sheet = workbook.Sheets[firstSheetName]!;
      const parsedRows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      if (parsedRows.length === 0) throw new Error("No rows found in the first sheet.");

      setRows(parsedRows);
      preview.mutate({ projectId, fileName: file.name, rows: parsedRows });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read that file.");
      setRows(null);
    }
  };

  const onConfirm = () => {
    if (!rows || !fileName) return;
    commit.mutate({ projectId, fileName, rows });
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Import articles" widthClassName="max-w-3xl">
      {!rows && !parseError && (
        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center">
          <p className="mb-3 text-sm text-slate-500">
            Upload a PubMed-style Excel export (.xlsx). Expected columns: PMID, Title, Authors,
            Citation, First Author, Journal/Book, Publication Year, Create Date, PMCID, NIHMS ID,
            DOI.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => void onFileChange(e)}
            className="mx-auto text-sm"
          />
        </div>
      )}

      {parseError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {parseError}
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={reset}>
              Try another file
            </Button>
          </div>
        </div>
      )}

      {rows && preview.isPending && (
        <p className="py-8 text-center text-sm text-slate-500">Validating {rows.length} rows…</p>
      )}

      {preview.data && !committed && (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge tone="neutral">{preview.data.summary.totalRows} rows</Badge>
            <Badge tone="green">{preview.data.summary.validRows} will import</Badge>
            <Badge tone="amber">{preview.data.summary.duplicateRows} duplicates</Badge>
            <Badge tone="red">{preview.data.summary.invalidRows} invalid</Badge>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Row</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5">Title</th>
                  <th className="px-2 py-1.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.data.results.map((row: RowResult) => (
                  <tr key={row.rowNumber}>
                    <td className="px-2 py-1.5 text-slate-500">{row.rowNumber}</td>
                    <td className="px-2 py-1.5">
                      <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                    </td>
                    <td className="max-w-[280px] px-2 py-1.5">
                      <span className="line-clamp-1">
                        {row.data?.title ?? rawTitle(row.raw)}
                      </span>
                    </td>
                    <td className="max-w-[240px] px-2 py-1.5 text-slate-500">
                      <span className="line-clamp-2">
                        {[row.reason, ...row.warnings].filter(Boolean).join(" ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {commit.error && <p className="mt-2 text-sm text-red-600">{commit.error.message}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={reset}>
              Choose a different file
            </Button>
            <Button
              onClick={onConfirm}
              disabled={commit.isPending || preview.data.summary.validRows === 0}
            >
              {commit.isPending
                ? "Importing…"
                : `Import ${preview.data.summary.validRows} article${preview.data.summary.validRows === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {committed && (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-slate-900">
            Imported {committed.inserted} article{committed.inserted === 1 ? "" : "s"}.
          </p>
          {committed.skipped > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              Skipped {committed.skipped} row{committed.skipped === 1 ? "" : "s"} (duplicates or
              invalid rows).
            </p>
          )}
          <Button className="mt-4" onClick={handleClose}>
            Done
          </Button>
        </div>
      )}
    </Dialog>
  );
}
