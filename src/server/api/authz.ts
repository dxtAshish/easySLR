import { TRPCError } from "@trpc/server";

import { type OrgRole, type PrismaClient, type ProjectRole } from "@prisma/client";

type Db = PrismaClient;

/**
 * Authorization boundaries for the workspace.
 *
 * Two levels of membership exist:
 *  - OrganizationMember: gates whether a user can see an org and its project
 *    list at all.
 *  - ProjectMember: gates whether a user can see a specific project's
 *    articles. An org OWNER implicitly gets OWNER-level access to every
 *    project in their org (they're accountable for the whole org); anyone
 *    else needs an explicit ProjectMember row. This mirrors how the UI lets
 *    an org owner create/manage projects without being added to each one by
 *    hand, while still letting an org owner scope specific reviewers to
 *    specific projects.
 *
 * These checks run in every procedure that touches org/project/article data
 * — the tRPC layer is the enforcement boundary, not the UI (hidden buttons
 * are not access control).
 */

export async function requireOrgMembership(
  db: Db,
  userId: string,
  organizationId: string,
) {
  const membership = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization.",
    });
  }
  return membership;
}

export async function requireOrgOwner(
  db: Db,
  userId: string,
  organizationId: string,
) {
  const membership = await requireOrgMembership(db, userId, organizationId);
  if (membership.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only an organization owner can perform this action.",
    });
  }
  return membership;
}

interface ProjectAccess {
  projectId: string;
  organizationId: string;
  role: ProjectRole;
  orgRole: OrgRole;
  viaOrgOwner: boolean;
}

export async function requireProjectAccess(
  db: Db,
  userId: string,
  projectId: string,
): Promise<ProjectAccess> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true },
  });
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  }

  const orgMembership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: project.organizationId,
        userId,
      },
    },
  });
  if (!orgMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this project.",
    });
  }

  if (orgMembership.role === "OWNER") {
    return {
      projectId: project.id,
      organizationId: project.organizationId,
      role: "OWNER",
      orgRole: orgMembership.role,
      viaOrgOwner: true,
    };
  }

  const projectMembership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!projectMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this project.",
    });
  }

  return {
    projectId: project.id,
    organizationId: project.organizationId,
    role: projectMembership.role,
    orgRole: orgMembership.role,
    viaOrgOwner: false,
  };
}

export async function requireProjectOwner(
  db: Db,
  userId: string,
  projectId: string,
) {
  const access = await requireProjectAccess(db, userId, projectId);
  if (access.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only a project owner can perform this action.",
    });
  }
  return access;
}
