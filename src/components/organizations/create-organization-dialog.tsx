"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/trpc/react";

export function CreateOrganizationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [name, setName] = useState("");

  const create = api.organization.create.useMutation({
    onSuccess: async (org) => {
      await utils.organization.list.invalidate();
      setName("");
      onClose();
      router.push(`/org/${org.id}`);
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="New organization">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name });
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cardiology Research Group"
          />
        </div>
        {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create organization"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
