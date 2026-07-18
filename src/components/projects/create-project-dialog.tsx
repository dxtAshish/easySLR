"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api } from "@/trpc/react";

export function CreateProjectDialog({
  organizationId,
  open,
  onClose,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = api.project.create.useMutation({
    onSuccess: async (project) => {
      await utils.project.list.invalidate({ organizationId });
      setName("");
      setDescription("");
      onClose();
      router.push(`/org/${organizationId}/projects/${project.id}`);
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="New project">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ organizationId, name, description: description || undefined });
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="project-name">Project name</Label>
          <Input
            id="project-name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cardiovascular Risk SLR"
          />
        </div>
        <div>
          <Label htmlFor="project-description">Description (optional)</Label>
          <Textarea
            id="project-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create project"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
