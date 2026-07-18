import { z } from "zod";

import { requireProjectOwner } from "@/server/api/authz";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { computeDedupeKeys, processImportRows, summarizeResults } from "@/lib/import/process";

const importInput = z.object({
  projectId: z.string(),
  fileName: z.string().trim().min(1).max(255),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

async function buildExistingKeys(
  db: Parameters<typeof requireProjectOwner>[0],
  projectId: string,
) {
  const existing = await db.article.findMany({
    where: { projectId },
    select: { pmid: true, doi: true, title: true, firstAuthor: true },
  });
  return new Set(
    existing.flatMap((a) =>
      computeDedupeKeys({
        pmid: a.pmid ?? undefined,
        doi: a.doi ?? undefined,
        title: a.title,
        firstAuthor: a.firstAuthor ?? undefined,
      }),
    ),
  );
}

/** Strips non-JSON-serializable values (e.g. Date instances from xlsx parsing) before storing in a Json column. */
function toJsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as object;
}

export const importRouter = createTRPCRouter({
  // Validates + dedupes without writing anything. The commit procedure
  // re-runs this same pipeline server-side rather than trusting whatever
  // the client says was "valid" in the preview response.
  preview: protectedProcedure.input(importInput).mutation(async ({ ctx, input }) => {
    await requireProjectOwner(ctx.db, ctx.session.user.id, input.projectId);
    const existingKeys = await buildExistingKeys(ctx.db, input.projectId);
    const results = processImportRows(input.rows, existingKeys);
    return { results, summary: summarizeResults(results) };
  }),

  commit: protectedProcedure.input(importInput).mutation(async ({ ctx, input }) => {
    await requireProjectOwner(ctx.db, ctx.session.user.id, input.projectId);
    const existingKeys = await buildExistingKeys(ctx.db, input.projectId);
    const results = processImportRows(input.rows, existingKeys);
    const summary = summarizeResults(results);

    const batch = await ctx.db.$transaction(async (tx) => {
      const created = await tx.importBatch.create({
        data: {
          projectId: input.projectId,
          importedById: ctx.session.user.id,
          fileName: input.fileName,
          totalRows: summary.totalRows,
          insertedRows: summary.validRows,
          duplicateRows: summary.duplicateRows,
          invalidRows: summary.invalidRows,
        },
      });

      const validRows = results.filter((r) => r.status === "valid" && r.data);
      if (validRows.length > 0) {
        // skipDuplicates is a second line of defense against races (e.g. two
        // concurrent imports for the same project) — the in-memory dedupe
        // pass above should already have caught every collision against
        // `existingKeys` computed at the top of this procedure.
        await tx.article.createMany({
          data: validRows.map((r) => ({
            projectId: input.projectId,
            importBatchId: created.id,
            ...r.data!,
          })),
          skipDuplicates: true,
        });
      }

      const skippedRows = results.filter((r) => r.status !== "valid");
      if (skippedRows.length > 0) {
        await tx.importRowError.createMany({
          data: skippedRows.map((r) => ({
            importBatchId: created.id,
            rowNumber: r.rowNumber,
            reason: r.reason ?? "Skipped.",
            rawData: toJsonSafe(r.raw),
          })),
        });
      }

      return created;
    });

    return { batchId: batch.id, summary };
  }),

  history: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, ctx.session.user.id, input.projectId);
      return ctx.db.importBatch.findMany({
        where: { projectId: input.projectId },
        include: { importedBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),
});
