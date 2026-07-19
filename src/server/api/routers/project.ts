import { z } from "zod";

import { requireOrgMembership, requireProjectAccess } from "@/server/api/authz";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const projectRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const membership = await requireOrgMembership(
        ctx.db,
        ctx.session.user.id,
        input.organizationId,
      );

      // Org owners see every project in the org; members only see projects
      // they've explicitly been added to.
      const where =
        membership.role === "OWNER"
          ? { organizationId: input.organizationId }
          : {
              organizationId: input.organizationId,
              members: { some: { userId: ctx.session.user.id } },
            };

      const projects = await ctx.db.project.findMany({
        where,
        include: {
          _count: { select: { articles: true, members: true } },
          members: {
            where: { userId: ctx.session.user.id },
            select: { role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
        articleCount: p._count.articles,
        memberCount: p._count.members,
        myRole: p.members[0]?.role ?? (membership.role === "OWNER" ? "OWNER" : null),
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().trim().min(1).max(150),
        description: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrgMembership(ctx.db, ctx.session.user.id, input.organizationId);

      return ctx.db.project.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          members: {
            create: { userId: ctx.session.user.id, role: "OWNER" },
          },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const access = await requireProjectAccess(ctx.db, ctx.session.user.id, input.projectId);
      const project = await ctx.db.project.findUniqueOrThrow({
        where: { id: input.projectId },
        include: { organization: { select: { id: true, name: true, slug: true } } },
      });
      return { ...project, myRole: access.role };
    }),

  stats: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.db, ctx.session.user.id, input.projectId);
      const grouped = await ctx.db.article.groupBy({
        by: ["status"],
        where: { projectId: input.projectId },
        _count: true,
      });
      const counts = { UNSCREENED: 0, INCLUDED: 0, EXCLUDED: 0, MAYBE: 0 };
      for (const g of grouped) counts[g.status] = g._count;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { counts, total };
    }),
});
