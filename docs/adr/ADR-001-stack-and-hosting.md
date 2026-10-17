# ADR-001: Single-file React app with a worker, published as a claude.ai artifact

**Status:** Accepted
**Date:** 2026-10-17
**Deciders:** Nico (owner), Claude (builder)

## Context

Tipping Point is the second fellowship prototype, frozen with Cut-in on 22 Nov 2026. Its
constraints overlap with Cut-in's and add two of its own:

- No spend beyond Nico's Claude Pro plan: no Lovable credits, no API key, no hosting bill.
- Experts open it from a link, some without a Claude account; it must also run offline.
- Forecast numbers must be deterministic and testable; AI drafts levers, reads policy texts and
  explains, but never sets a number unconfirmed (plan, "Where AI is used").
- **New:** Monte Carlo (500 draws × 6 markets × 18 years) and calibration are heavy enough to
  freeze a page on the main thread.
- **New:** the scenario copilot needs Claude to call the model through page tools, so it answers
  from computed numbers rather than guesses.
- The workspace can't reach the shadcn registry, Zenodo, Eurostat or the Commission's download
  servers (proxy 403); npm works.

## Decision

React 19 + TypeScript (strict) built by Vite with `vite-plugin-singlefile` into one HTML file,
published as a claude.ai artifact after `scripts/to-artifact.mjs` strips the document skeleton.
Heavy runs go to a web worker imported with `?worker&inline` (started from a blob: URL), with a
main-thread fallback in `src/worker/client.ts`. Live AI uses the `sample` capability with page
`tools`, on the viewer's own plan; exports use `downloads`. The model is a pure TypeScript module.

## Options considered

### A: Single-file React app as a claude.ai artifact (chosen)

| Dimension   | Assessment                                                              |
| ----------- | ----------------------------------------------------------------------- |
| Complexity  | Medium: one build, one file, one worker                                 |
| Cost        | Zero beyond the Pro plan                                                |
| Sharing     | Link from the artifact's Share menu; the offline copy is the same bytes |
| Familiarity | Same stack as Cut-in; scripts and harness carried over (ADR-002)        |

Pros: free, shareable, offline-capable, AI with page tools and no keys. Cons: no network in the
frame (data, fonts and map outlines bundled), no `print()`, no `mailto:`, AI absent for
signed-out visitors, blob workers refused on `file://`.

### B: Python + Streamlit

Pros: pandas and scipy for calibration. Cons: needs hosting and an API key, no page tools, two
languages for model and UI, weaker interaction (no draggable ratio line on the tipping-point
view). The calibration maths is small enough to write and test in TypeScript.

### C: Lovable app

Pros: fast UI iteration, hosted URL. Cons: credits (Nico declined), less control over the model
and its tests.

## Trade-off analysis

A keeps one language and one type system for data, model, worker and UI, which matters more
here than in Cut-in because the same functions run in the worker, the tests and the copilot's
page tools. Its frame limits are designed around: bundled assets, the downloads capability,
stored AI examples when `sample` is absent, and a main-thread fallback for the worker.

## Version pins and choices

All dependencies pinned exactly (`npm i -E`), same pins as Cut-in where shared (TypeScript
5.9.3, ESLint 9.39.5, Vite 8.3.4, React 19.3.1, Zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1).
New for the Europe map: d3-geo 3.1.1, topojson-client 3.1.0, world-atlas 2.0.2 (Natural Earth
outlines, bundled). `@xyflow/react` is not needed. The normal CDF and quantile, the seeded
generator (xoshiro128\*\*), the Nelder–Mead fitter and the Latin hypercube are our own, each
tested against reference values (mpmath at 30 digits for the normal). `npm audit` reports
`braces` via vite-plugin-singlefile: build-time only, no fixed version, accepted as in Cut-in.

## Spike results (TP P1)

| Check                         | Local `file://`                                | Served over http | Inside claude.ai |
| ----------------------------- | ---------------------------------------------- | ---------------- | ---------------- |
| Inline worker (blob: URL)     | Refused, falls back                            | Runs             | See below        |
| Seeded estimate of Φ(1), 200k | 0.8411 (exact 0.8413), identical on both paths | 0.8411           | See below        |
| `sample` and page tools       | Absent (as designed)                           | Absent           | See below        |

The in-frame column is filled after Nico opens the published link (TP P1 check).

## Consequences

- Easier: the copilot's tools call the same pure functions the tests cover.
- Easier: Playwright runs against the exact file we publish, offline and served.
- Harder: anything shared between viewers (a scenario library) needs `db` and signed-in viewers.
- Revisit: if page tools are unavailable in the frame, the copilot falls back to one JSON call
  that returns a lever diff, and the page runs the model itself.

## Action items

1. [x] Scaffold, pins, `to-artifact`, `prepublish-check` with the anonymity and former-employer lists.
2. [x] Worker spike with fallback; seeded generator and normal distribution with tests.
3. [x] Publish the shell artifact.
4. [ ] Nico opens the link signed in and in a private window; records the in-frame column.
