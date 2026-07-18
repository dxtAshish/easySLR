import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

const SALT_ROUNDS = 10;

export const authRouter = createTRPCRouter({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Name is required").max(100),
        email: z.string().trim().email("Enter a valid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await hash(input.password, SALT_ROUNDS);
      const user = await ctx.db.user.create({
        data: { name: input.name, email: input.email, passwordHash },
        select: { id: true, email: true },
      });

      return user;
    }),
});
