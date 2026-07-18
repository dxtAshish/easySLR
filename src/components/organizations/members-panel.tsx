"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/states";
import { api } from "@/trpc/react";

export function MembersPanel({
  organizationId,
  isOwner,
}: {
  organizationId: string;
  isOwner: boolean;
}) {
  const utils = api.useUtils();
  const { data, isLoading } = api.organization.members.list.useQuery({ organizationId });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [error, setError] = useState<string | null>(null);

  const invite = api.organization.members.invite.useMutation({
    onError: (err) => setError(err.message),
    onSuccess: async () => {
      setEmail("");
      setError(null);
      await utils.organization.members.list.invalidate({ organizationId });
    },
  });

  const remove = api.organization.members.remove.useMutation({
    onSuccess: async () => {
      await utils.organization.members.list.invalidate({ organizationId });
    },
  });

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Members</h2>

      {isLoading && <LoadingState label="Loading members…" />}

      {data && (
        <ul className="mb-4 divide-y divide-slate-100">
          {data.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-slate-500">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={m.role === "OWNER" ? "blue" : "neutral"}>{m.role}</Badge>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate({ organizationId, userId: m.userId })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate({ organizationId, email, role });
          }}
          className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"
        >
          <Input
            type="email"
            required
            placeholder="teammate@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="max-w-xs"
          />
          <Select value={role} onChange={(e) => setRole(e.target.value as "OWNER" | "MEMBER")}>
            <option value="MEMBER">Member</option>
            <option value="OWNER">Owner</option>
          </Select>
          <Button type="submit" size="sm" disabled={invite.isPending}>
            {invite.isPending ? "Adding…" : "Add member"}
          </Button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
      {isOwner && (
        <p className="mt-2 text-xs text-slate-400">
          The teammate must already have an EasySLR account (registered with this email) before
          they can be added.
        </p>
      )}
    </Card>
  );
}
