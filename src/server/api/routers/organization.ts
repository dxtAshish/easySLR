import { z } from "zod";

import { requireOrgMembership, requireOrgOwner } from "@/server/api/authz";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { slugify } from "@/lib/slug";

async function uniqueSlug(db: Parameters<typeof requireOrgMembership>[0], name: string) {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;
  while (await db.organization.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

export const organizationRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.organizationMember.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        organization: {
          include: { _count: { select: { projects: true, members: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      projectCount: m.organization._count.projects,
      memberCount: m.organization._count.members,
    }));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const slug = await uniqueSlug(ctx.db, input.name);
      return ctx.db.organization.create({
        data: {
          name: input.name,
          slug,
          members: {
            create: { userId: ctx.session.user.id, role: "OWNER" },
          },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const membership = await requireOrgMembership(
        ctx.db,
        ctx.session.user.id,
        input.organizationId,
      );
      const organization = await ctx.db.organization.findUniqueOrThrow({
        where: { id: input.organizationId },
      });
      return { ...organization, myRole: membership.role };
    }),

  members: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ organizationId: z.string() }))
      .query(async ({ ctx, input }) => {
        await requireOrgMembership(ctx.db, ctx.session.user.id, input.organizationId);
        return ctx.db.organizationMember.findMany({
          where: { organizationId: input.organizationId },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        });
      }),

    invite: protectedProcedure
      .input(
        z.object({
          organizationId: z.string(),
          email: z.string().trim().email(),
          role: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireOrgOwner(ctx.db, ctx.session.user.id, input.organizationId);

        const user = await ctx.db.user.findUnique({ where: { email: input.email } });
        if (!user) {
          throw new Error(
            "No account found for that email. The user must register first.",
          );
        }

        return ctx.db.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: user.id,
            },
          },
          create: { organizationId: input.organizationId, userId: user.id, role: input.role },
          update: { role: input.role },
        });
      }),

    remove: protectedProcedure
      .input(z.object({ organizationId: z.string(), userId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await requireOrgOwner(ctx.db, ctx.session.user.id, input.organizationId);

        const ownerCount = await ctx.db.organizationMember.count({
          where: { organizationId: input.organizationId, role: "OWNER" },
        });
        const target = await ctx.db.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: input.userId,
            },
          },
        });
        if (target?.role === "OWNER" && ownerCount <= 1) {
          throw new Error("An organization must keep at least one owner.");
        }

        await ctx.db.organizationMember.delete({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: input.userId,
            },
          },
        });
        return { success: true };
      }),
  }),
});
