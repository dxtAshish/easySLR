import { authRouter } from "@/server/api/routers/auth";
import { organizationRouter } from "@/server/api/routers/organization";
import { projectRouter } from "@/server/api/routers/project";
import { articleRouter } from "@/server/api/routers/article";
import { importRouter } from "@/server/api/routers/import";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  organization: organizationRouter,
  project: projectRouter,
  article: articleRouter,
  import: importRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.organization.list();
 */
export const createCaller = createCallerFactory(appRouter);
