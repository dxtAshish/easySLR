"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { ArticleFilters } from "@/components/articles/article-filters";
import { ArticleReviewDialog } from "@/components/articles/article-review-dialog";
import type { ArticleStatusValue } from "@/components/articles/article-status";
import { STATUS_LABEL } from "@/components/articles/article-status";
import { ArticleTable, type SortField } from "@/components/articles/article-table";
import { ImportWizard } from "@/components/articles/import-wizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { api, type RouterOutputs } from "@/trpc/react";

const PAGE_SIZE = 25;

type Article = RouterOutputs["article"]["list"]["items"][number];

export function ArticleWorkspace({
  projectId,
  myRole,
}: {
  projectId: string;
  myRole: "OWNER" | "REVIEWER";
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<ArticleStatusValue>>(new Set());
  const [labelFilter, setLabelFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewingArticle, setReviewingArticle] = useState<Article | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ArticleStatusValue>("INCLUDED");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const listInput = useMemo(
    () => ({
      projectId,
      search: search || undefined,
      status: statusFilter.size > 0 ? Array.from(statusFilter) : undefined,
      label: labelFilter || undefined,
      sortBy,
      sortDir,
      page,
      pageSize: PAGE_SIZE,
    }),
    [projectId, search, statusFilter, labelFilter, sortBy, sortDir, page],
  );

  const articles = api.article.list.useQuery(listInput, { placeholderData: keepPreviousData });
  const stats = api.project.stats.useQuery({ projectId });
  const labels = api.article.labels.useQuery({ projectId });
  const utils = api.useUtils();

  const bulkUpdate = api.article.bulkUpdateStatus.useMutation({
    onSuccess: async () => {
      setSelectedIds(new Set());
      await utils.article.list.invalidate();
      await utils.project.stats.invalidate();
    },
  });

  const exportCsv = api.article.exportCsv.useMutation({
    onSuccess: (result) => {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `articles-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  const toggleStatusFilter = (status: ArticleStatusValue) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = articles.data?.items.map((a) => a.id) ?? [];
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(pageIds));
  };

  const onSort = (field: SortField) => {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const hasFilters = search || statusFilter.size > 0 || labelFilter;
  const total = articles.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {stats.data &&
            (Object.entries(stats.data.counts) as [ArticleStatusValue, number][]).map(
              ([status, count]) => (
                <Badge key={status} tone="neutral">
                  {STATUS_LABEL[status]}: {count}
                </Badge>
              ),
            )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportCsv.mutate(listInput)}
            disabled={exportCsv.isPending || total === 0}
          >
            {exportCsv.isPending ? "Exporting…" : "Export CSV"}
          </Button>
          {myRole === "OWNER" && (
            <Button size="sm" onClick={() => setImportOpen(true)}>
              Import articles
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <ArticleFilters
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          statusFilter={statusFilter}
          onToggleStatus={toggleStatusFilter}
          labelOptions={labels.data ?? []}
          labelFilter={labelFilter}
          onLabelFilterChange={(v) => {
            setLabelFilter(v);
            setPage(1);
          }}
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2">
          <span className="text-sm text-slate-600">{selectedIds.size} selected</span>
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as ArticleStatusValue)}
          >
            {(Object.keys(STATUS_LABEL) as ArticleStatusValue[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={bulkUpdate.isPending}
            onClick={() =>
              bulkUpdate.mutate({
                projectId,
                articleIds: Array.from(selectedIds),
                status: bulkStatus,
              })
            }
          >
            Apply to selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {articles.isLoading && <LoadingState label="Loading articles…" />}
      {articles.error && (
        <ErrorState message={articles.error.message} onRetry={() => void articles.refetch()} />
      )}

      {articles.data?.items.length === 0 && (
        <EmptyState
          title={hasFilters ? "No articles match your filters" : "No articles yet"}
          message={
            hasFilters
              ? "Try clearing search or filters."
              : myRole === "OWNER"
                ? "Import an Excel file to get started."
                : "The project owner hasn't imported any articles yet."
          }
          action={
            myRole === "OWNER" && !hasFilters ? (
              <Button onClick={() => setImportOpen(true)}>Import articles</Button>
            ) : undefined
          }
        />
      )}

      {articles.data && articles.data.items.length > 0 && (
        <>
          <ArticleTable
            articles={articles.data.items}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={onSort}
            onRowClick={setReviewingArticle}
          />

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {page} of {totalPages} · {total} article{total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <ArticleReviewDialog article={reviewingArticle} onClose={() => setReviewingArticle(null)} />
      {myRole === "OWNER" && (
        <ImportWizard projectId={projectId} open={importOpen} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}
