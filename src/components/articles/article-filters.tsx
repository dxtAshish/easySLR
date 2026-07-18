"use client";

import { ARTICLE_STATUSES, STATUS_LABEL, type ArticleStatusValue } from "@/components/articles/article-status";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

export function ArticleFilters({
  searchInput,
  onSearchInputChange,
  statusFilter,
  onToggleStatus,
  labelOptions,
  labelFilter,
  onLabelFilterChange,
}: {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  statusFilter: Set<ArticleStatusValue>;
  onToggleStatus: (status: ArticleStatusValue) => void;
  labelOptions: string[];
  labelFilter: string;
  onLabelFilterChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={searchInput}
        onChange={(e) => onSearchInputChange(e.target.value)}
        placeholder="Search title, author, journal, DOI, PMID…"
        className="max-w-xs"
        aria-label="Search articles"
      />

      <div className="flex gap-1.5" role="group" aria-label="Filter by status">
        {ARTICLE_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onToggleStatus(status)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter.has(status)
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50",
            )}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      {labelOptions.length > 0 && (
        <Select
          value={labelFilter}
          onChange={(e) => onLabelFilterChange(e.target.value)}
          aria-label="Filter by label"
        >
          <option value="">All labels</option>
          {labelOptions.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
