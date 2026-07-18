# EasySLR — Article Review Workspace

A product slice of EasySLR's systematic-literature-review tool: organizations own projects,
projects own imported articles, and teams screen those articles in a table-driven workflow
(search / filter / sort / bulk decisions / CSV export).

Built with **Next.js (App Router) + React + TypeScript**, **Tailwind CSS**, **Prisma +
PostgreSQL**, **NextAuth (Credentials)**, and **tRPC** — starting from `create-t3-app`.

---

## Contents

- [Setup](#setup)
- [Demo login](#demo-login)
- [Architecture](#architecture)
- [Domain model](#domain-model)
- [Authorization](#authorization)
- [Review workflow](#review-workflow)
- [Article import](#article-import)
- [Frontend structure](#frontend-structure)
- [Testing](#testing)
- [Assumptions & tradeoffs](#assumptions--tradeoffs)
- [Deployment status](#deployment-status)
- [AI usage disclosure](#ai-usage-disclosure)
- [Approximate time spent](#approximate-time-spent)
- [What I'd improve next](#what-id-improve-next)

---

## Setup

**Prerequisites:** Node 20+, npm, and a PostgreSQL database (local via Docker/WSL, or any
Postgres-compatible connection string — Neon/Supabase/RDS all work).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in AUTH_SECRET (generate with `npx auth secret`) and DATABASE_URL.

# 3. Start Postgres locally (optional helper — requires Docker/WSL on Windows)
./start-database.sh
# ...or point DATABASE_URL at any Postgres instance you already have.

# 4. Push the schema and seed demo data
npm run db:push
npm run db:seed

# 5. Run the app
npm run dev
```

Open http://localhost:3000. You can register a new account, or sign in with the seeded demo
account below.

To try the import flow with real data, use the provided `sample_article_import.xlsx` (or any
Excel export with PubMed-style columns) from inside a project.

### Other useful commands

```bash
npm run test        # Vitest — import validation + authorization unit tests
npm run typecheck   # tsc --noEmit
npm run lint         # next lint
npm run db:studio   # Prisma Studio (inspect data)
```

## Demo login

Seeding creates one account with an organization and project already set up:

- **Email:** `demo@easyslr.dev`
- **Password:** `password123`
- Organization: *Demo Research Lab* → Project: *Cardiovascular Risk SLR* (6 pre-loaded articles
  across all four review statuses, so the table/filters/stats have something to show
  immediately).

---

## Architecture

```
src/
  app/                        # Next.js App Router pages
    (workspace)/               # Route group: authenticated shell (Navbar + auth-gated)
      dashboard/                # List/create organizations
      org/[organizationId]/     # Org detail: projects + members
        projects/[projectId]/    # The article review workspace
    login/, register/          # Public auth pages
  server/
    api/
      routers/                 # auth, organization, project, article, import
      authz.ts                 # Server-side authorization boundary (see below)
      trpc.ts, root.ts
    auth/                      # NextAuth config (Credentials provider)
    db.ts                       # Prisma client singleton
  components/
    ui/                        # Reusable primitives: Button, Input, Select, Badge, Dialog, states
    articles/                  # Article table, filters, review dialog, import wizard
    organizations/, projects/  # Org/project list + membership UI
    layout/                    # Navbar, sign-out button
  lib/
    import/                    # Pure, framework-free import pipeline (mapping/validation/dedupe)
    csv.ts, slug.ts, cn.ts
prisma/
  schema.prisma
  seed.ts
```

**Why tRPC over REST/server actions:** every article-review action (status change, bulk update,
import) needs a request/response shape that's shared verbatim between client and server. tRPC
gives that for free — `RouterOutputs["article"]["list"]` is the real inferred type, so the table
component, the review dialog, and the router itself can never drift out of sync. Server actions
would work too, but you lose the typed-query-cache integration (`useQuery`, `invalidate`,
`useUtils`) that React Query gives tRPC — which is what makes cache invalidation after a review
update or an import a few lines instead of manual state plumbing.

**Server components + prefetch, client components for interactivity.** Pages like
`dashboard/page.tsx` and the project workspace page are `async` server components that call
`api.<router>.<query>.prefetch(...)` (the RSC caller from `src/trpc/server.ts`) and wrap children
in `<HydrateClient>`. The actual interactive pieces (`OrganizationList`, `ArticleWorkspace`, …)
are client components using `api.<router>.<query>.useQuery(...)` from `src/trpc/react.tsx` — they
pick up the prefetched cache instantly (no loading flash on first paint), then take over for
mutations/pagination/filtering client-side. This is the standard create-t3-app RSC pattern, used
consistently rather than mixing in ad-hoc `fetch` calls.

## Domain model

```
User ──< OrganizationMember >── Organization ──< Project ──< ProjectMember >── User
                                                    │
                                                    └──< Article ──< ImportBatch ──< ImportRowError
```

- **Organization** — top-level tenant. Has `OrganizationMember` rows with role `OWNER | MEMBER`.
- **Project** — belongs to one organization. Has `ProjectMember` rows with role
  `OWNER | REVIEWER`.
- **Article** — belongs to one project. Carries the PubMed-style import fields (`pmid`, `title`,
  `authors`, `citation`, `firstAuthor`, `journal`, `pubYear`, `createDate`, `pmcid`, `nihmsId`,
  `doi`) plus review fields (`status`, `reviewerNotes`, `labels[]`, `reviewedBy`, `reviewedAt`).
- **ImportBatch / ImportRowError** — one row per file upload, with a per-row-skip audit trail
  (row number, reason, raw cell data) so a user can see *why* a row didn't come in.

Full schema: [`prisma/schema.prisma`](prisma/schema.prisma).

## Authorization

Enforced entirely in `src/server/api/authz.ts`, called from every procedure that touches org/
project/article data — **not** just hidden in the UI. Two boundaries:

1. **Org membership** gates whether you can see an organization and its project list at all.
2. **Project membership** gates whether you can see a specific project's articles.

An org `OWNER` implicitly gets `OWNER`-level access to *every* project in their org (they created
it and are accountable for it — this is also why an org owner can create a project without a
separate "add me to this project" step). Everyone else (`MEMBER`) needs an explicit
`ProjectMember` row before they can see a project's articles at all — this is the
"article visibility must be scoped by project access" requirement from the brief, and it's a real
boundary: a plain org member with no `ProjectMember` row gets `FORBIDDEN` from every article
procedure, confirmed by the `requireProjectAccess` unit tests in
[`src/server/api/authz.test.ts`](src/server/api/authz.test.ts).

Within a project, `REVIEWER`s can view/search/filter and change an article's review status/notes/
labels; only project `OWNER`s can import articles, delete articles, or manage project membership.
Adding someone to a project also checks they're already a member of the parent organization —
you can't shortcut around the org boundary by adding a stranger straight to a project.

## Review workflow

Each article carries one shared **status** — `Unscreened → Included / Excluded / Maybe` — plus
free-text **reviewer notes** and freeform **labels** (e.g. `RCT`, `low-risk-of-bias`).

I deliberately made this a *single decision per article* rather than one row per reviewer. A
proper dual-blind-screening workflow (two independent reviewers, then a conflict-resolution step)
is the "real" SLR pattern and is the natural next iteration — but it roughly doubles the data
model (`ArticleReview` as its own entity, a reconciliation UI, conflict states) for a feature the
brief explicitly leaves open ("you may choose... or another mechanism you believe is useful").
Given the timebox, a single shared decision + notes + labels is coherent, is what most small
teams actually do first, and leaves an obvious, well-scoped next step (noted below) rather than a
half-built multi-reviewer system.

Reviewing happens two ways in the UI:
- **Single article** — click a row to open a dialog with a status toggle, labels, and notes.
- **Bulk** — select rows via checkboxes, pick a status, "Apply to selected" (`bulkUpdateStatus`).

## Article import

Flow: pick an `.xlsx` file → the browser parses it with `xlsx` (`sheet_to_json`) → the raw rows
are sent to `import.preview` (validates + dedupes, **writes nothing**) → the preview table shows
a per-row status (`valid` / `duplicate` / `invalid`) and reason → confirming calls `import.commit`,
which **re-validates from scratch** server-side (never trusts the client's "valid" flag) and
persists in a transaction, writing an `ImportBatch` plus one `ImportRowError` per skipped row.

Validation choices (all in [`src/lib/import/`](src/lib/import), unit tested):

- **Header matching is normalized and alias-tolerant** (`mapRow.ts`) — `"Journal/Book"` and
  `"Journal"` both map to the same field, case/punctuation-insensitively, since real PubMed
  exports aren't perfectly consistent.
- **Only a missing `Title` is a hard failure.** Everything else (a garbled publication year, an
  unparseable create date, a non-numeric PMID) is coerced best-effort and downgraded to a
  *warning* attached to the row, rather than rejecting the whole row over one bad cell. This
  matches how messy real bibliographic exports are — you'd rather get 95% of a row's data with a
  flagged year than lose the row entirely.
- **"Create Date" is parsed as a UTC calendar date, not with the native `Date` constructor.**
  PubMed exports this column as a bare `YYYY/MM/DD` string. `new Date("2024/03/18")` parses
  slash-separated dates as *local* midnight, but storage/serialization (Postgres, JSON) happens
  in UTC — in any server timezone behind UTC that silently shifts the stored date back a day.
  `parseDateOnly` in `validateRow.ts` constructs the date from its year/month/day components via
  `Date.UTC(...)` instead, so the stored date always matches what the file says regardless of
  where the app is deployed.
- **PMID and DOI are checked as independent dedupe keys, not a priority fallback**
  (`dedupe.ts`). A row is a duplicate if *either* its PMID or its DOI matches something already
  seen — not just whichever one happens to be checked first. This matters because the database
  enforces both as separate unique constraints (`[projectId, pmid]` and `[projectId, doi]`); a
  row with a fresh PMID but a DOI reused from an earlier row is still a duplicate, and treating
  PMID as strictly "preferred" over DOI would let it through app-level validation as valid, only
  to blow up the whole batch on the DB constraint at commit time. The normalized
  `title + firstAuthor` fallback only kicks in for rows with *neither* identifier, and is scoped
  tightly (exact normalized match, not fuzzy) so it doesn't accidentally collapse two distinct
  articles that merely share a title.
- **Duplicates are checked two ways in one pass**: against earlier rows *in the same file*, and
  against articles *already in the project* (`projectId`-scoped, so importing the same file into
  two different projects doesn't cross-contaminate). Both dedupe constraints are also enforced at
  the database level (`@@unique([projectId, pmid])`, `@@unique([projectId, doi])`) as a second
  line of defense against races.
- **Import is restricted to project `OWNER`s** — reviewers can view/screen but not mutate the
  article set, keeping "who can change what's in scope" answerable.

Known limitation: `commit` re-sends the full row set from the browser rather than referencing a
server-side staged upload. Fine for spreadsheet-sized imports (thousands of rows); a much larger
import would want a persisted upload + background job instead of round-tripping the whole payload.

## Frontend structure

- **`components/ui/`** — small, unstyled-opinionated primitives (`Button`, `Input`, `Select`,
  `Badge`, `Dialog`, `Card`, loading/empty/error states) used everywhere so the app doesn't grow
  five different button styles. No UI kit dependency — just Tailwind + a `cn()` helper.
- **`components/articles/`** — `ArticleTable` (sortable columns, row selection), `ArticleFilters`
  (debounced search + status chips + label select), `ArticleReviewDialog` (single-article
  review), `ImportWizard` (file → preview → commit, all in one Dialog).
- Filter/sort/pagination state lives in local component state (`ArticleWorkspace`), not the URL —
  a deliberate scope cut; see "What I'd improve next."

## Testing

`npm run test` runs Vitest against the parts of the system where a bug would be easy to miss and
expensive in a real review (import correctness, authorization boundaries):

- **`src/lib/import/validateRow.test.ts`** — missing title fails the row; well-formed rows parse
  correctly; a bad year/PMID becomes a warning, not a rejection; header aliasing works.
- **`src/lib/import/process.test.ts`** — in-file duplicate detection (by PMID and by
  title+author fallback), duplicate-vs-existing-project detection, and that an invalid row
  doesn't corrupt the dedupe pass for the row after it.
- **`src/server/api/authz.test.ts`** — the authorization boundary itself, against a mocked
  Prisma client: missing project → `NOT_FOUND`; non-member → `FORBIDDEN`; org owner gets implicit
  project access; plain org member with no `ProjectMember` row is `FORBIDDEN`; `REVIEWER` can't
  perform owner-only actions.

These are pure-function/unit tests by design (no test database) so they run fast and don't need
Postgres — the import pipeline and authz logic are written as framework-free functions specifically
so they're testable this way.

## Assumptions & tradeoffs

- **Credentials auth, not OAuth.** The brief allows "NextAuth/Auth.js or a comparable approach."
  I used email+password (bcrypt-hashed) instead of Discord/GitHub OAuth so the app runs fully
  locally with zero external app registration — an evaluator shouldn't need to create a Discord
  app to log in. `Account`/`Session`/`VerificationToken` tables stay in the schema so an OAuth
  provider can be added later without a migration.
- **Adding someone to an org/project requires them to already have an account.** There's no
  email-invite/magic-link flow — the brief doesn't ask for one, and building real email delivery
  was out of scope for the timebox. "Invite" here means "grant access to an existing user by
  email," which still fully demonstrates the membership/authorization model.
- **One shared review decision per article**, not one row per reviewer — see
  [Review workflow](#review-workflow) above.
- **Filters/sort/pagination are local component state**, not URL query params — simpler and
  fully sufficient for the requirement ("support useful organization through search, sorting,
  filtering"); loses shareable/bookmarkable filtered views, which I'd add back first given more
  time.
- **CSV export ignores pagination** (exports every article matching the current filters, not just
  the current page) — that's almost always what "export my reviewed articles" means in practice.

## Deployment status

**Not deployed.** AWS/SST deployment was left out of scope for this timebox in favor of a
complete, well-tested local slice — per the brief, "a smaller, working, well-explained submission
is better than a large unfinished one," and I'd rather that hold for the deployment story too
than ship a half-configured SST stack I couldn't verify end-to-end.

If deploying, the shape I'd use: **SST** on AWS, Next.js on Lambda (or a small Fargate service if
cold starts matter), RDS Postgres (or Neon to skip VPC networking), migrations run via
`prisma migrate deploy` as a one-off deploy-time task (not `db push`, which is dev-only),
`AUTH_SECRET`/`DATABASE_URL` in SST `Secret`s (never committed — `.env` is gitignored and only
`.env.example` is tracked), and CloudWatch for logs. Main failure modes to handle: a migration
failing mid-deploy (run migrations as a distinct, rollback-able step before swapping traffic) and
connection-pool exhaustion under Lambda concurrency (would add RDS Proxy or Prisma Accelerate).

## AI usage disclosure

I used Claude (Anthropic) as an AI pair-programmer for a large share of this implementation:
scaffolding the Prisma schema, tRPC routers, the import validation pipeline, and the React
components, working from the assignment PDF.

- **What I personally verified:** the authorization model end-to-end (traced every procedure to
  confirm `requireProjectAccess`/`requireProjectOwner` is actually called, not just present
  somewhere in the file); the import dedupe logic against the sample PubMed columns; that
  `npm run typecheck`, `npm run lint`, and `npm run test` all pass; and I read every generated
  file rather than accepting output unreviewed.
- **One example of rejecting/correcting AI output:** the first draft of the dedupe key logic
  (`computeDedupeKey` in `dedupe.ts`) picked a *single* identifier per row with a priority order —
  PMID if present, else DOI, else title+author. It read cleanly and every hand-written test passed.
  It was wrong: the database enforces PMID and DOI as two *independent* unique constraints
  (`[projectId, pmid]` and `[projectId, doi]`), so a row with a brand-new PMID but a DOI copied
  from an earlier row would pass the priority-based check (PMID wins, DOI never gets looked at),
  get marked "valid" in the import preview, and then blow up the entire commit transaction on the
  DB constraint — turning one bad row into a failed import for every row in the batch. I caught
  this by hand-tracing a realistic PubMed-style test file that included a row explicitly titled
  "Duplicate DOI example" with its own unique PMID, and found the priority logic would silently
  let it through. Fixed in `computeDedupeKeys` (now plural) to check PMID and DOI as independent
  keys — a row is a duplicate if *either* matches — with regression tests added for both
  directions (unique PMID + duplicate DOI, and unique DOI + duplicate PMID) in
  `src/lib/import/process.test.ts`.

## Approximate time spent

This was produced in a single focused AI-assisted session rather than the 8–12 hours of manual
engineering the brief anchors on. Disclosing that directly here per the AI usage policy, rather
than back-filling a manual-equivalent estimate — see the disclosure above for exactly what was
AI-authored vs. personally verified.

## What I'd improve next

If given more time, in priority order:

1. **Dual-reviewer screening + conflict resolution** — the natural next step from the current
   single-decision model (see [Review workflow](#review-workflow)): two independent `ArticleReview`
   rows per article, a computed "agreement" status, and a conflict-resolution UI.
2. **URL-persisted filters/saved views** — move filter/sort/page state into the URL (shareable
   links, browser back/forward) and let a user name and save a filter combination.
3. **Row-level import preview pagination** — the preview table currently renders every row; for a
   multi-thousand-row file that should paginate/virtualize.
4. **Real invitations** — email/magic-link invites instead of requiring the invitee to already
   have an account.
5. **AWS/SST deployment** — per the [Deployment status](#deployment-status) section above.
