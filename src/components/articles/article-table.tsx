"use client";

import { ArticleStatusBadge } from "@/components/articles/article-status-badge";
import { cn } from "@/lib/cn";
import { type RouterOutputs } from "@/trpc/react";

type Article = RouterOutputs["article"]["list"]["items"][number];
export type SortField = "createdAt" | "title" | "pubYear" | "firstAuthor" | "status";

const COLUMNS: { field: SortField | null; label: string; className?: string }[] = [
  { field: "title", label: "Title" },
  { field: "firstAuthor", label: "First author" },
  { field: null, label: "Journal" },
  { field: "pubYear", label: "Year", className: "text-right" },
  { field: "status", label: "Status" },
  { field: null, label: "Labels" },
  { field: "createdAt", label: "Imported" },
];

export function ArticleTable({
  articles,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
}: {
  articles: Article[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  sortBy: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
  onRowClick: (article: Article) => void;
}) {
  const allSelected = articles.length > 0 && articles.every((a) => selectedIds.has(a.id));

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="w-10 px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Select all articles on this page"
              />
            </th>
            {COLUMNS.map((col) => (
              <th key={col.label} className={cn("px-3 py-2 font-medium", col.className)}>
                {col.field ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.field!)}
                    className="inline-flex items-center gap-1 hover:text-slate-800"
                  >
                    {col.label}
                    {sortBy === col.field && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {articles.map((article) => (
            <tr
              key={article.id}
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => onRowClick(article)}
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(article.id)}
                  onChange={() => onToggleSelect(article.id)}
                  aria-label={`Select ${article.title}`}
                />
              </td>
              <td className="max-w-xs px-3 py-2">
                <p className="line-clamp-2 font-medium text-slate-900">{article.title}</p>
                {article.pmid && <p className="text-xs text-slate-400">PMID {article.pmid}</p>}
              </td>
              <td className="px-3 py-2 text-slate-600">{article.firstAuthor ?? "—"}</td>
              <td className="max-w-[160px] px-3 py-2 text-slate-600">
                <span className="line-clamp-2">{article.journal ?? "—"}</span>
              </td>
              <td className="px-3 py-2 text-right text-slate-600">{article.pubYear ?? "—"}</td>
              <td className="px-3 py-2">
                <ArticleStatusBadge status={article.status} />
              </td>
              <td className="max-w-[160px] px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {article.labels.map((label) => (
                    <span
                      key={label}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                {new Date(article.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
