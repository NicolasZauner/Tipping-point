# Tipping Point

Forecasts new-car registrations by powertrain (BEV, PHEV, full hybrid, ICE) for DE, FR, ES, IT,
NL and BE to 2035, from a TCO ratio against ICE and five adopter groups calibrated on EU survey
and registration data. Second fellowship prototype for Nico Zauner (IESE Data & AI Club), next
to Cut-in. The plan is `docs/plan.md`; work is driven by its **prompt playbook** (TP P1 to
TP P20). Read the plan section for the prompt you're on before starting.

## Every session

1. `git pull` (the cloud workspace is wiped after inactivity; the repo is the only memory).
2. Find the prompt number in Nico's message ("TP P7") and its row in the playbook.
3. Load the skills that row names.
4. Finish on **green**: `npm run check` passes, plus `npm run e2e` when UI changed.
5. Commit, push, add one line to `CHANGELOG.md`, and copy what Nico should see into
   `C:\Users\nicoz\OneDrive\Escritorio\MBA\AI\AI Fellowship\Tipping Point\` when his computer
   is linked. His raw downloads arrive in that folder's `data-raw\`.
6. Reply with: what changed, what was tested, what Nico must check.

On a day Nico also works on Cut-in, its prompt goes first: it has the earlier deadline.

## Rules that decide correctness

- **AI drafts, the model computes, a person confirms.** Every forecast number comes from
  `src/model`. AI output (`src/ai`) is validated with Zod, shown as a diff, and changes a lever
  only after Nico confirms. Every number in AI-written text must exist in model output (number
  guard).
- **The model is pure.** No React, no `Date`, no `Math.random`, no I/O (ESLint enforces).
  Randomness enters as a seeded `Rng` passed in. Same inputs, same forecast.
- **Units:** money is real 2025 euros (deflate nominal sources with HICP first), years are
  integers, shares are fractions in [0, 1]. Conversions live in one tested module.
- **Every value has a passport:** unit, source, link, retrieval date, confidence, low and high.
  A value without a source is rejected at load.
- Every sort has an explicit tie-breaker; ties in the choice rule go to the more conservative
  powertrain (ICE, then FHEV, PHEV, BEV). Every switch over a union is exhaustive.
- Golden snapshots change only after Nico has reviewed the diff.
- Every UI string goes through `src/i18n` (English and German, same keys and placeholders).

## Hard limits

- **Anonymity.** Two interviewees asked not to be named; their names and employers never appear
  anywhere in the repo. Maurice Graessner may be named.
- **Former employer.** The app, `src/`, `tests/` and the root docs never name the consulting
  firm whose model inspired this one. The About page says "inspired by models I built in
  consulting". Nothing comes from that firm's model, data, surveys or parameter values. The
  private plan in `docs/` may name it. `scripts/prepublish-check.mjs` enforces both lists.
- **The artifact frame** has no network, no `print()`, no `alert/confirm/prompt`, unreliable
  `mailto:`. Bundle every asset; offer files through the `downloads` capability; storage stays
  inside `src/platform/storage.ts` guards. Workers start from blob: URLs (`?worker&inline`) and
  always have the main-thread fallback in `src/worker/client.ts`: Chromium refuses blob workers
  on `file://`, so the offline copy runs on the main thread.

## Publishing

`npm run build` writes `dist/index.html` (offline copy) and `dist/artifact.html` (what the
Artifact tool publishes, skeleton stripped). Publish `dist/artifact.html` to the artifact URL in
`docs/links.md`; never create a second one. Capabilities: `sample`, `downloads`.

## Where things are

- `docs/plan.md` the build plan (copy of Nico's doc; the doc is the source of truth)
- `docs/adr/` decisions; scope, model spec, domain, segments and data reports as they land
- `src/model` TCO, adoption, market, calibration, Monte Carlo · `src/domain` types
- `src/ai` prompts, schemas, page tools, number guard · `src/ui` screens · `src/i18n` strings
- `src/worker` off-main-thread runs · `src/platform` claude.ai runtime and storage guards
