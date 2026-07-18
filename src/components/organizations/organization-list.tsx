"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/trpc/react";

export function OrganizationList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, error, refetch } = api.organization.list.useQuery();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Your organizations</h1>
          <p className="text-sm text-slate-500">
            Organizations contain projects. Projects contain the articles you review.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>New organization</Button>
      </div>

      {isLoading && <LoadingState label="Loading organizations…" />}
      {error && <ErrorState message={error.message} onRetry={() => void refetch()} />}

      {data?.length === 0 && (
        <EmptyState
          title="No organizations yet"
          message="Create an organization to start a project and import articles."
          action={<Button onClick={() => setDialogOpen(true)}>New organization</Button>}
        />
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((org) => (
            <Link key={org.id} href={`/org/${org.id}`}>
              <Card className="h-full p-5 transition hover:border-slate-400">
                <div className="mb-2 flex items-start justify-between">
                  <h2 className="font-medium text-slate-900">{org.name}</h2>
                  <Badge tone={org.role === "OWNER" ? "blue" : "neutral"}>{org.role}</Badge>
                </div>
                <p className="text-sm text-slate-500">
                  {org.projectCount} project{org.projectCount === 1 ? "" : "s"} ·{" "}
                  {org.memberCount} member{org.memberCount === 1 ? "" : "s"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateOrganizationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
