import { compare } from "bcryptjs";
import { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig as edgeConfig } from "@/server/auth/edge-config";
import { db } from "@/server/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Full auth config for the Node runtime (API routes, server components,
 * tRPC context). Extends the edge-safe base with the actual Credentials
 * provider — see `edge-config.ts` for why these are split.
 *
 * We intentionally do NOT use the Prisma adapter here: it manages
 * database-backed sessions/OAuth account linking, neither of which applies
 * to a Credentials-only setup. Credentials providers require the `jwt`
 * session strategy regardless of adapter, so the adapter would add
 * complexity (Account/Session writes) without buying us anything. If an
 * OAuth provider is added later, re-introduce PrismaAdapter(db) then.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  ...edgeConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (rawCredentials) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;

        const isValid = await compare(parsed.data.password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
} satisfies NextAuthConfig;
