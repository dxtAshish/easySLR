import Link from "next/link";

import { MembersPanel } from "@/components/organizations/members-panel";
import { ProjectList } from "@/components/projects/project-list";
import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  const session = await auth();
  const organization = await api.organization.getById({ organizationId });
  await Promise.all([
    api.project.list.prefetch({ organizationId }),
    api.organization.members.list.prefetch({ organizationId }),
  ]);

  return (
    <HydrateClient>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← All organizations
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{organization.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProjectList organizationId={organizationId} />
        </div>
        <div>
          <MembersPanel
            organizationId={organizationId}
            isOwner={organization.myRole === "OWNER"}
            currentUserId={session!.user.id}
          />
        </div>
      </div>
    </HydrateClient>
  );
}
