import { OrganizationList } from "@/components/organizations/organization-list";
import { api, HydrateClient } from "@/trpc/server";

export default async function DashboardPage() {
  void api.organization.list.prefetch();

  return (
    <HydrateClient>
      <OrganizationList />
    </HydrateClient>
  );
}
