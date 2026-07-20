import { type DefaultSession, type NextAuthConfig } from "next-auth";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

/**
 * Edge-safe base config: no providers, no bcrypt, no Prisma. `middleware.ts`
 * runs on the Edge runtime and only needs to decode the session JWT to
 * gate routes — it never calls a provider's `authorize()`. Keeping this
 * config free of Node-only dependencies (bcryptjs, the Prisma client) stops
 * them from being pulled into the Edge middleware bundle at all.
 * `./config.ts` spreads this and adds the real Credentials provider for use
 * in the Node runtime (API routes, server components, tRPC).
 *
 * @see https://authjs.dev/guides/edge-compatibility
 */
export const authConfig = {
  providers: [],
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string,
      },
    }),
  },
} satisfies NextAuthConfig;
