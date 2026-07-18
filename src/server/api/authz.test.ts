import { type TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { requireProjectAccess, requireProjectOwner } from "./authz";

type FakeDb = Parameters<typeof requireProjectAccess>[0];

function fakeDb(overrides: {
  project?: { id: string; organizationId: string } | null;
  orgMembership?: { role: "OWNER" | "MEMBER" } | null;
  projectMembership?: { role: "OWNER" | "REVIEWER" } | null;
}): FakeDb {
  return {
    project: { findUnique: vi.fn().mockResolvedValue(overrides.project ?? null) },
    organizationMember: {
      findUnique: vi.fn().mockResolvedValue(overrides.orgMembership ?? null),
    },
    projectMember: {
      findUnique: vi.fn().mockResolvedValue(overrides.projectMembership ?? null),
    },
  } as unknown as FakeDb;
}

describe("requireProjectAccess", () => {
  it("throws NOT_FOUND when the project does not exist", async () => {
    const db = fakeDb({ project: null });
    await expect(requireProjectAccess(db, "user-1", "missing-project")).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<TRPCError>);
  });

  it("throws FORBIDDEN when the user isn't a member of the parent organization", async () => {
    const db = fakeDb({
      project: { id: "p1", organizationId: "org1" },
      orgMembership: null,
    });
    await expect(requireProjectAccess(db, "user-1", "p1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<TRPCError>);
  });

  it("grants implicit OWNER access to an org owner with no explicit ProjectMember row", async () => {
    const db = fakeDb({
      project: { id: "p1", organizationId: "org1" },
      orgMembership: { role: "OWNER" },
      projectMembership: null,
    });
    const access = await requireProjectAccess(db, "user-1", "p1");
    expect(access.role).toBe("OWNER");
    expect(access.viaOrgOwner).toBe(true);
  });

  it("throws FORBIDDEN for an org member with no explicit ProjectMember row", async () => {
    const db = fakeDb({
      project: { id: "p1", organizationId: "org1" },
      orgMembership: { role: "MEMBER" },
      projectMembership: null,
    });
    await expect(requireProjectAccess(db, "user-1", "p1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<TRPCError>);
  });

  it("grants access matching the explicit ProjectMember role for a plain org member", async () => {
    const db = fakeDb({
      project: { id: "p1", organizationId: "org1" },
      orgMembership: { role: "MEMBER" },
      projectMembership: { role: "REVIEWER" },
    });
    const access = await requireProjectAccess(db, "user-1", "p1");
    expect(access.role).toBe("REVIEWER");
    expect(access.viaOrgOwner).toBe(false);
  });
});

describe("requireProjectOwner", () => {
  it("rejects a REVIEWER trying to perform an owner-only action", async () => {
    const db = fakeDb({
      project: { id: "p1", organizationId: "org1" },
      orgMembership: { role: "MEMBER" },
      projectMembership: { role: "REVIEWER" },
    });
    await expect(requireProjectOwner(db, "user-1", "p1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<TRPCError>);
  });
});
