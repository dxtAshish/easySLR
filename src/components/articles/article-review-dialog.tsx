"use client";

import { useEffect, useState } from "react";

import { ARTICLE_STATUSES, STATUS_LABEL, type ArticleStatusValue } from "@/components/articles/article-status";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api, type RouterOutputs } from "@/trpc/react";

type Article = RouterOutputs["article"]["list"]["items"][number];

export function ArticleReviewDialog({
  article,
  onClose,
}: {
  article: Article | null;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [status, setStatus] = useState<ArticleStatusValue>("UNSCREENED");
  const [notes, setNotes] = useState("");
  const [labelsInput, setLabelsInput] = useState("");

  useEffect(() => {
    if (!article) return;
    setStatus(article.status);
    setNotes(article.reviewerNotes ?? "");
    setLabelsInput(article.labels.join(", "));
  }, [article]);

  const update = api.article.updateReview.useMutation({
    onSuccess: async () => {
      await utils.article.list.invalidate();
      await utils.project.stats.invalidate();
      await utils.article.labels.invalidate();
      onClose();
    },
  });

  if (!article) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      articleId: article.id,
      status,
      reviewerNotes: notes,
      labels: labelsInput
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
    });
  };

  return (
    <Dialog open={!!article} onClose={onClose} title="Review article" widthClassName="max-w-2xl">
      <div className="mb-4 space-y-1">
        <p className="text-sm font-medium text-slate-900">{article.title}</p>
        <p className="text-xs text-slate-500">
          {article.firstAuthor ?? article.authors ?? "Unknown author"}
          {article.journal ? ` · ${article.journal}` : ""}
          {article.pubYear ? ` · ${article.pubYear}` : ""}
          {article.pmid ? ` · PMID ${article.pmid}` : ""}
        </p>
        {article.doi && (
          <p className="text-xs text-slate-400">
            DOI:{" "}
            <a
              href={`https://doi.org/${article.doi}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {article.doi}
            </a>
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Decision</Label>
          <div className="flex flex-wrap gap-2">
            {ARTICLE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                  (status === s
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50")
                }
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="labels">Labels (comma separated)</Label>
          <Input
            id="labels"
            value={labelsInput}
            onChange={(e) => setLabelsInput(e.target.value)}
            placeholder="e.g. RCT, low-risk-of-bias"
          />
        </div>

        <div>
          <Label htmlFor="notes">Reviewer notes</Label>
          <Textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {update.error && <p className="text-sm text-red-600">{update.error.message}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save review"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
