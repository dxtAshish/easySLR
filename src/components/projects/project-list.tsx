"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/trpc/react";

export function ProjectList({ organizationId }: { organizationId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, error, refetch } = api.project.list.useQuery({ organizationId });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          New project
        </Button>
      </div>

      {isLoading && <LoadingState label="Loading projects…" />}
      {error && <ErrorState message={error.message} onRetry={() => void refetch()} />}

      {data?.length === 0 && (
        <EmptyState
          title="No projects yet"
          message="Create a project to start importing and reviewing articles."
          action={<Button onClick={() => setDialogOpen(true)}>New project</Button>}
        />
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((project) => (
            <Link key={project.id} href={`/org/${organizationId}/projects/${project.id}`}>
              <Card className="h-full p-5 transition hover:border-slate-400">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-medium text-slate-900">{project.name}</h3>
                  {project.myRole && (
                    <Badge tone={project.myRole === "OWNER" ? "blue" : "neutral"}>
                      {project.myRole}
                    </Badge>
                  )}
                </div>
                {project.description && (
                  <p className="mb-2 line-clamp-2 text-sm text-slate-500">{project.description}</p>
                )}
                <p className="text-sm text-slate-500">
                  {project.articleCount} article{project.articleCount === 1 ? "" : "s"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectDialog
        organizationId={organizationId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
