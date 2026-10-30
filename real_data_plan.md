# Plan: Replace Dashboard Fixtures With Real Neo4j Data

## Current state (confirmed by investigation)

Only 2 of ~15 dashboard widgets talk to the real backend today: `crew-console.tsx` and `network-strength.tsx` (both via the generic `crewAction()` dispatcher in `src/lib/api.ts` → `POST /crew/action`). Everything else reads from `src/lib/fixtures.ts` or inline hardcoded arrays, and no backend endpoints exist for most of it. The Neo4j graph is very likely empty for your user (no seed data, no ingested contacts).

Fixture-only today: `dashboard/contacts/page.tsx`, `dashboard/contacts/[id]/page.tsx`, `dashboard/lead-o-meter/page.tsx`, `dashboard/crew/{snap,gatekeeper,pulse,recall,nudge}/page.tsx`, and 5 of the 7 widgets on the main `dashboard/page.tsx` (`chief-briefing`, `opportunities`, `relationship-coverage`, `crew-activity`, `recent-wins`).

## Step 0 — Get your Firebase UID (needed before seeding)

Sample data has to be attached to `(:User {firebaseUid: ...})` so it shows up when you're logged in. When we get to the seeding step, either:
- Give me your login email and I'll add a small script step that resolves it to a UID via `firebase_admin.auth.get_user_by_email(email)`, or
- Open the Firebase Console → Authentication → Users tab and copy your UID directly.

## Step 1 — Neo4j schema (decided, will implement in code step)

Keep it denormalized on `Person` nodes where reasonable, add separate node types only where the fixture data is genuinely list-shaped:

- `(:User {firebaseUid})` — already exists.
- `(:User)-[:KNOWS]->(:Person {id, name, title, company, initials, met_at, met_date, last_contact, channel, warmth, signals, last_crew, autonomy, org_tags, handles, enrichment_json})` — extends the existing `Person` node used by `create_person`. `enrichment_json` stores the nested enrichment blob as a JSON string (simplest fit for Neo4j's flat property model).
- `(:Person)-[:HAD_INTERACTION]->(:Interaction {channel, summary, date, direction})`
- `(:Person)-[:HAS_DRAFT]->(:Draft {crew, subject, body, reasoning, status, created_at})`
- `(:Person)-[:WARMTH_POINT]->(:WarmthPoint {date, score})`
- `(:Person)-[:HAS_VOICE_NOTE]->(:VoiceNote {url, transcript, created_at})`
- `(:User)-[:HAS_ACTIVITY]->(:ActivityEntry {crew, summary, created_at})`
- `(:User)-[:HAS_CARD]->(:Card {name, status, source, created_at})` — Snap's "cards in processing" queue.
- Analytics (`lead-o-meter`: growth chart, channel share, top active contacts) will be **computed live via Cypher aggregation** over `Person`/`Interaction` dates rather than stored redundantly — this only works if seeded contacts have `met_date`/interaction dates spread realistically across the last several months, which the seed script will do on purpose.

## Step 2 — New backend routes (FastAPI)

All under existing auth pattern (`Depends(verify_user)` / `get_current_user` — worth de-duplicating these two near-identical implementations while touching this code).

- `backend/app/routes/contacts.py`
  - `GET /contacts` → list contacts for user (maps to `fixtureContacts` shape)
  - `GET /contacts/{id}` → single contact + enrichment + interactions + warmth timeline (maps to what `contacts/[id]/page.tsx` needs)
- Extend `backend/app/routes/dashboard.py`
  - `GET /dashboard/analytics` → `fixtureAnalyticsSummary` + growth + channel share + top active (lead-o-meter)
  - `GET /dashboard/activity` → activity feed (`recent-wins`, `crew-activity` widgets)
  - `GET /dashboard/opportunities` → replaces the hardcoded `opportunities.tsx` array (people flagged as "reconnect" candidates — can reuse `people_needing_followup` query already in `graph_service.py`)
  - `GET /dashboard/coverage` → replaces `relationship-coverage.tsx` (aggregate by `org_tags`)
- Per-crew routes (`backend/app/routes/{gatekeeper,pulse,recall,nudge}.py` if they don't already do real queries, `snap` already partially handled by scanner)
  - `GET /crew/{name}/drafts` or extend `crew_service.py` action handlers — drafts and cards queries.

New Pydantic schemas in `backend/app/schemas/` for response shapes (currently only `crew.py`/`scanner.py` exist) — worth adding `contacts.py`, `dashboard.py` schemas instead of returning raw dicts, since there's no typed contract today.

## Step 3 — Frontend: typed API client

`src/lib/api.ts` currently only has one exported function (`crewAction`). Add:
- A shared `apiFetch<T>(path, options)` helper (auth header + base URL, refactored out of `crewAction`'s existing logic).
- `getContacts()`, `getContact(id)`, `getDashboardAnalytics()`, `getDashboardActivity()`, `getOpportunities()`, `getCoverage()`, plus per-crew fetchers as routes are added.

## Step 4 — Rewire frontend components off fixtures

Replace fixture imports with the new API calls + loading/error states, component by component:
1. `contacts/page.tsx`, `contacts/[id]/page.tsx` (drop `fixtureContacts`/`contactById`/etc.)
2. `dashboard/page.tsx` widgets: `chief-briefing.tsx`, `opportunities.tsx`, `relationship-coverage.tsx`, `crew-activity.tsx`, `recent-wins.tsx`
3. `dashboard/lead-o-meter/page.tsx` (drop `fixtureAnalyticsSummary`/`fixtureGrowth`/etc.)
4. `dashboard/crew/{snap,gatekeeper,pulse,recall,nudge}/page.tsx`

Keep `CREW` (the 5 crew-member label/color definitions in `fixtures.ts`) as-is — that's static UI config, not data, no need to make it "real."

## Step 5 — Seed script

`backend/seed_data.py`, run once manually (`python seed_data.py <your-email>`):
- Resolves your Firebase UID from email via Admin SDK.
- Creates/merges the `(:User)` node.
- Creates ~20-25 `Person` nodes with realistic, varied `met_date`/`last_contact` spread across the last 6 months, varied `warmth`/`channel`/`org_tags`, so aggregation queries (growth chart, coverage, channel share) produce meaningful output instead of a flat line.
- Creates a handful of `Interaction`, `Draft`, `WarmthPoint`, `ActivityEntry`, and `Card` nodes per person so the detail pages and activity feed aren't empty either.
- Idempotent-ish: safe to re-run (use `MERGE` keyed on a stable `id` per fixture-equivalent row, not `CREATE`), so re-running doesn't duplicate data.

## Order of execution when we get to the coding part

1. Seed script + schema (Step 1 + Step 5) first — so there's real data to query while building/testing routes.
2. Backend routes (Step 2), tested directly via `/docs` (Swagger UI) before touching frontend.
3. Frontend API client (Step 3).
4. Rewire components one at a time (Step 4), verifying each in the browser via Playwright before moving to the next, since this touches ~10 files and it's easy to silently regress one while fixing another.

Ping me when you're ready to start and tell me which step you want to begin with (recommend starting at Step 0/5 — seeding — since nothing else is testable without real data in the graph).
