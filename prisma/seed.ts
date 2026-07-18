import { hash } from "bcryptjs";

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEMO_EMAIL = "demo@easyslr.dev";
const DEMO_PASSWORD = "password123";

const SEED_ARTICLES = [
  {
    pmid: "36000001",
    title: "Statin therapy and cardiovascular risk reduction: a systematic review",
    firstAuthor: "Nguyen T",
    authors: "Nguyen T, Patel R, Owusu K",
    journal: "J Cardiovasc Med",
    pubYear: 2023,
    doi: "10.1000/jcm.2023.001",
    status: "INCLUDED" as const,
    labels: ["RCT", "high-quality"],
    reviewerNotes: "Meets inclusion criteria; large multi-site RCT.",
  },
  {
    pmid: "36000002",
    title: "Observational cohort of hypertension management in primary care",
    firstAuthor: "Alvarez M",
    authors: "Alvarez M, Kim J",
    journal: "Prim Care Res",
    pubYear: 2022,
    doi: "10.1000/pcr.2022.014",
    status: "MAYBE" as const,
    labels: ["cohort"],
    reviewerNotes: "Unclear follow-up duration — flag for second reviewer.",
  },
  {
    pmid: "36000003",
    title: "Case report: rare adverse event following beta-blocker initiation",
    firstAuthor: "Singh P",
    authors: "Singh P",
    journal: "Case Rep Cardiol",
    pubYear: 2021,
    status: "EXCLUDED" as const,
    labels: [],
    reviewerNotes: "Case report — excluded per study-design criteria.",
  },
  {
    pmid: "36000004",
    title: "Meta-analysis of lifestyle interventions for cardiovascular risk factors",
    firstAuthor: "Chen L",
    authors: "Chen L, Rossi F, Dubois A",
    journal: "Eur Heart J",
    pubYear: 2024,
    doi: "10.1000/ehj.2024.077",
    status: "INCLUDED" as const,
    labels: ["meta-analysis", "high-quality"],
    reviewerNotes: "Directly relevant; extract effect sizes.",
  },
  {
    pmid: "36000005",
    title: "Cardiovascular outcomes in a pediatric population: a scoping review",
    firstAuthor: "Okafor N",
    authors: "Okafor N, Diallo S",
    journal: "Pediatr Cardiol Rev",
    pubYear: 2020,
    status: "EXCLUDED" as const,
    labels: [],
    reviewerNotes: "Wrong population (pediatric) — out of scope.",
  },
  {
    pmid: "36000006",
    title: "New biomarkers for early detection of atherosclerosis: a review",
    firstAuthor: "Kowalski A",
    authors: "Kowalski A, Nilsson E",
    journal: "Atherosclerosis",
    pubYear: 2023,
    status: "UNSCREENED" as const,
    labels: [],
  },
];

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { name: "Demo Reviewer", email: DEMO_EMAIL, passwordHash },
  });

  const organization = await db.organization.upsert({
    where: { slug: "demo-research-lab" },
    update: {},
    create: {
      name: "Demo Research Lab",
      slug: "demo-research-lab",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const existingProject = await db.project.findFirst({
    where: { organizationId: organization.id, name: "Cardiovascular Risk SLR" },
  });
  const project =
    existingProject ??
    (await db.project.create({
      data: {
        organizationId: organization.id,
        name: "Cardiovascular Risk SLR",
        description: "Systematic review of cardiovascular risk-reduction interventions.",
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    }));

  const articleCount = await db.article.count({ where: { projectId: project.id } });
  if (articleCount === 0) {
    for (const article of SEED_ARTICLES) {
      await db.article.create({
        data: {
          projectId: project.id,
          ...article,
          reviewedById: article.status === "UNSCREENED" ? undefined : user.id,
          reviewedAt: article.status === "UNSCREENED" ? undefined : new Date(),
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Organization: ${organization.name} (${organization.id})`);
  console.log(`Project: ${project.name} (${project.id})`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
