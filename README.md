# Tipping Point

Forecasts new-car registrations by powertrain (BEV, PHEV, full hybrid, ICE) for six European
markets to 2035. A TCO ratio against a combustion car drives five adopter groups, each with its
own switching threshold, calibrated on public EU survey and registration data. Claude drafts
scenarios, reads policy texts and explains results; the model computes every number; a person
confirms.

Built by Nico Zauner for the IESE Data & AI Club Industry Fellowship (automotive track).
Status: in development, frozen 22 Nov 2026.

```sh
npm ci
npm run check   # typecheck, lint, tests, build, pre-publish check
npm run e2e     # Playwright on the built single file
```

See `CLAUDE.md` for the rules every session follows and `docs/plan.md` for the plan.
