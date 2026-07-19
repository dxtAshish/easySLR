import { type Prisma } from "@prisma/client";
import { z } from "zod";

import { requireProjectAccess } from "@/server/api/authz";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { buildCsv } from "@/lib/csv";

const ARTICLE_STATUS_VALUES = ["UNSCREENED", "INCLUDED", "EXCLUDED", "MAYBE"] as const;
const SORTABLE_FIELDS = ["createdAt", "title", "pubYear", "firstAuthor", "status"] as const;

const listInput = z.object({
  projectId: z.string(),
  search: z.string().trim().max(200).optional(),
  status: z.array(z.enum(ARTICLE_STATUS_VALUES)).optional(),
  label: z.string().trim().max(100).optional(),
  sortBy: z.enum(SORTABLE_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
});

function buildOrderBy(
  sortBy: (typeof SORTABLE_FIELDS)[number],
  sortDir: "asc" | "desc",
): Prisma.ArticleOrderByWithRelationInput {
  switch (sortBy) {
    case "title":
      return { title: sortDir };
    case "pubYear":
      return { pubYear: sortDir };
    case "firstAuthor":
      return { firstAuthor: sortDir };
    case "status":
      return { status: sortDir };
    case "createdAt":
    default:
      return { createdAt: sortDir };
  }
}

function buildWhere(input: z.infer<typeof listInput>): Prisma.ArticleWhereInput {
  const where: Prisma.ArticleWhereInput = { projectId: input.projectId };
  if (input.status?.length) where.status = { in: input.status };
  if (input.label) where.labels = { has: input.label };
  if (input.search) {
    where.OR = [
      { title: { contains: input.search, mode: "insensitive" } },
      { authors: { contains: input.search, mode: "insensitive" } },
      { firstAuthor: { contains: input.search, mode: "insensitive" } },
      { journal: { contains: input.search, mode: "insensitive" } },
      { doi: { contains: input.search, mode: "insensitive" } },
      { pmid: { contains: input.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export const articleRouter = createTRPCRouter({
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    await requireProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

    const where = buildWhere(input);
    const [items, total] = await Promise.all([
      ctx.db.article.findMany({
        where,
        orderBy: buildOrderBy(input.sortBy, input.sortDir),
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: { reviewedBy: { select: { id: true, name: true } } },
      }),
      ctx.db.article.count({ where }),
    ]);

    return { items, total, page: input.page, pageSize: input.pageSize };
  }),

  labels: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.db, ctx.session.user.id, input.projectId);
      const articles = await ctx.db.article.findMany({
        where: { projectId: input.projectId, labels: { isEmpty: false } },
        select: { labels: true },
      });
      return Array.from(new Set(articles.flatMap((a) => a.labels))).sort();
    }),

  updateReview: protectedProcedure
    .input(
      z.object({
        articleId: z.string(),
        status: z.enum(ARTICLE_STATUS_VALUES).optional(),
        reviewerNotes: z.string().max(5000).optional(),
        labels: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const article = await ctx.db.article.findUniqueOrThrow({
        where: { id: input.articleId },
        select: { projectId: true },
      });
      await requireProjectAccess(ctx.db, ctx.session.user.id, article.projectId);

      return ctx.db.article.update({
        where: { id: input.articleId },
        data: {
          ...(input.status !== undefined && { status: input.status }),
          ...(input.reviewerNotes !== undefined && { reviewerNotes: input.reviewerNotes }),
          ...(input.labels !== undefined && { labels: input.labels }),
          reviewedById: ctx.session.user.id,
          reviewedAt: new Date(),
        },
      });
    }),

  bulkUpdateStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        articleIds: z.array(z.string()).min(1).max(500),
        status: z.enum(ARTICLE_STATUS_VALUES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const result = await ctx.db.article.updateMany({
        where: { id: { in: input.articleIds }, projectId: input.projectId },
        data: { status: input.status, reviewedById: ctx.session.user.id, reviewedAt: new Date() },
      });
      return { updated: result.count };
    }),

  exportCsv: protectedProcedure.input(listInput.omit({ page: true, pageSize: true })).mutation(
    async ({ ctx, input }) => {
      await requireProjectAccess(ctx.db, ctx.session.user.id, input.projectId);

      const where = buildWhere({ ...input, page: 1, pageSize: 1 });
      const articles = await ctx.db.article.findMany({
        where,
        orderBy: buildOrderBy(input.sortBy, input.sortDir),
      });

      const csv = buildCsv(
        [
          { header: "PMID", value: (a) => a.pmid },
          { header: "Title", value: (a) => a.title },
          { header: "Authors", value: (a) => a.authors },
          { header: "First Author", value: (a) => a.firstAuthor },
          { header: "Journal", value: (a) => a.journal },
          { header: "Publication Year", value: (a) => a.pubYear },
          { header: "DOI", value: (a) => a.doi },
          { header: "Status", value: (a) => a.status },
          { header: "Labels", value: (a) => a.labels.join("; ") },
          { header: "Reviewer Notes", value: (a) => a.reviewerNotes },
          { header: "Reviewed At", value: (a) => a.reviewedAt?.toISOString() ?? "" },
        ],
        articles,
      );
      return { csv, count: articles.length };
    },
  ),
});
