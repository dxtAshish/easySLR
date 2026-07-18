import Link from "next/link";

import { ArticleWorkspace } from "@/components/articles/article-workspace";
import { api, HydrateClient } from "@/trpc/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ organizationId: string; projectId: string }>;
}) {
  const { organizationId, projectId } = await params;

  const project = await api.project.getById({ projectId });
  void api.article.list.prefetch({ projectId, sortBy: "createdAt", sortDir: "desc", page: 1, pageSize: 25 });
  void api.project.stats.prefetch({ projectId });
  void api.article.labels.prefetch({ projectId });

  return (
    <HydrateClient>
      <div className="mb-6">
        <Link href={`/org/${organizationId}`} className="text-sm text-slate-500 hover:underline">
          ← {project.organization.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{project.name}</h1>
        {project.description && <p className="text-sm text-slate-500">{project.description}</p>}
      </div>

      <ArticleWorkspace projectId={projectId} myRole={project.myRole === "OWNER" ? "OWNER" : "REVIEWER"} />
    </HydrateClient>
  );
}
