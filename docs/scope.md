# Scope (TP P2, signed off by Nico on 19 Oct 2026)

Nico accepted the round-1 recommendations with three changes: four vehicle classes with a
mapping from national segment schemes, a 2025 base with a CAGR per market, and AI features as
the highlight of the app. He left the calibration design to Claude. Decisions D13 to D18 are
the follow-ups Claude settled under that mandate; Nico can overturn any of them at P3 review.

## Decisions

| #   | Topic                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Horizon                  | Annual model 2018 to 2040. 2036 to 2040 drawn lighter as "outlook" with wider bands. Headline numbers and goal seek stop at 2035.                                                                                                                                                                                                                                                                                                            |
| D2  | TCO time frame           | First owner: 6 years private, 4 years company, residual value at the end. A fixed 10-year life without residual value is a toggle in Assumptions.                                                                                                                                                                                                                                                                                            |
| D3  | Discount rate            | Real 5% private, 6% company, editable. Short-sightedness is left to the adopter thresholds and the calibration, so it isn't counted twice.                                                                                                                                                                                                                                                                                                   |
| D4  | Buyer types              | Private with home charging, private without, company car, plus a "tactical" bucket (dealer self-registrations and rental) at a fixed share per market that follows the average mix and runs no TCO.                                                                                                                                                                                                                                          |
| D5  | Vehicle classes          | Four: small, medium, large (SUV), premium. A mapping layer turns any source segmentation (KBA segments, European A to F segments, national schemes, a model list) into the four classes with weights. The AI segment mapper drafts it; code checks it (D13).                                                                                                                                                                                 |
| D6  | Hybrids                  | Mild hybrids count as ICE throughout. Full hybrids are forecast. History is split with national data where it exists, a labelled share elsewhere; the backtest scores the combined hybrid share.                                                                                                                                                                                                                                             |
| D7  | Total market             | 2025 actual registrations per market times a CAGR per market, editable, with sources for the default CAGRs. The CSV import (now core, D13) replaces the path with your own forecast.                                                                                                                                                                                                                                                         |
| D8  | Calibration and backtest | Rolling-origin evaluation (D15). The forecast itself uses parameters fitted on all years 2018 to 2025.                                                                                                                                                                                                                                                                                                                                       |
| D9  | Policy history           | National purchase grants with effective dates, registration taxes, annual circulation taxes, company-car taxation and VAT for all six markets; the Flemish zero-emission premium for Belgium. Scrappage, other regional schemes and city access rules stay out, stated on the Data screen.                                                                                                                                                   |
| D10 | Uncertainty bands        | Precomputed at build time for the six scenarios (part of the goldens). Edited scenarios show the central line at once and get bands on "Run uncertainty".                                                                                                                                                                                                                                                                                    |
| D11 | Saved scenarios          | Browser storage on the viewer's device, plus JSON export and import through downloads. A shared library is v2.                                                                                                                                                                                                                                                                                                                               |
| D12 | Stretch order            | "Where do I sit?" first, "Ask a segment" second, both only if every gate holds. The CSV mapper is no longer a stretch (D13).                                                                                                                                                                                                                                                                                                                 |
| D13 | AI is the highlight      | Nine AI features on one pattern (Claude reads or drafts, code checks and computes, a person confirms), a visible AI quality page with measured accuracy, and a "show the work" trace on every AI answer. AI work moves earlier in the playbook. Details below.                                                                                                                                                                               |
| D14 | Premium class            | A car is premium if its brand is on the premium list (Audi, BMW, Mercedes-Benz, Porsche, Volvo, Polestar, Lexus, Jaguar, Land Rover, Genesis, Maserati) or its list price is at least €60,000. Tesla is classed by price, not brand. Both rules are editable data. Because one premium brand shares its name with an anonymised interviewee's former employer, the pre-publish check bans only that employer's two-word name, not the brand. |
| D15 | Backtest design          | Fit on data up to an origin year, forecast one and two years ahead, for origins 2021, 2022 and 2023. Report mean absolute error in percentage points of share against two naive baselines (last year's share, linear trend). The headline chart is origin 2023: Germany's 2024 dip and 2025 rebound. Inputs in the test years are the ones that actually happened, and the app says so.                                                      |
| D16 | Company-car taxation     | One simplified rule per market (DE 1% / 0.5% / 0.25% benefit in kind, BE deductibility and CO2 solidarity contribution, NL bijtelling, FR avantage en nature, ES and IT benefit in kind), each sourced and labelled "simplified".                                                                                                                                                                                                            |
| D17 | OEM pricing push         | A lever "BEV transaction discount" per market and year, default 0, low confidence. The market shift in the calibration absorbs the historical average; S5 uses the lever.                                                                                                                                                                                                                                                                    |
| D18 | Where calibration runs   | At build time in a script; fitted parameters are committed data with their own passport. A "refit" button in the worker is v2.                                                                                                                                                                                                                                                                                                               |
| D19 | UI languages             | English and German. Spanish is v2.                                                                                                                                                                                                                                                                                                                                                                                                           |

## Default class mapping for Germany (KBA segments)

The segment mapper proposes this; code applies the premium override after it.

| KBA segment                                | Class        |
| ------------------------------------------ | ------------ |
| Minis, Kleinwagen                          | Small        |
| Kompaktklasse, Mittelklasse, Mini-Vans     | Medium       |
| SUVs, Geländewagen, Großraum-Vans          | Large (SUV)  |
| Obere Mittelklasse, Oberklasse, Sportwagen | Premium      |
| Utilities, Wohnmobile                      | Out of scope |

Premium override: a model from a premium brand or at €60,000 and above moves to Premium,
whatever its segment. Volumes must reconcile with the KBA segment totals within 0.5%.

## AI features (D13)

| #   | Feature              | Claude does                                                                                                    | Code does                                                                                       | Person confirms         |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------- |
| A1  | Scenario copilot     | Turns a question or story into a lever diff; runs the model through page tools; explains                       | Validates the diff against the lever catalogue and limits; runs the model; number guard         | The diff before a run   |
| A2  | Assumption critic    | Reviews a scenario like a sceptical partner: values outside sourced ranges, odd combinations, missing policies | Supplies ranges and passports through tools; every number it cites must come from data          | Which flags to act on   |
| A3  | Policy reader        | Rule text in five languages to grant and tax levers, each field with its source passage                        | Word-for-word passage check, limits, dates                                                      | Each field              |
| A4  | Segment mapper       | Any segmentation or model list to the four classes, with reason and confidence                                 | Weights sum to 1; volumes reconcile with source totals; premium override; unmapped rows flagged | The mapping table       |
| A5  | Forecast file mapper | A messy CSV or Excel export to columns, units and market codes                                                 | Parses every value; checks totals; preview                                                      | The mapping             |
| A6  | Explain this chart   | Three sentences on what any chart shows                                                                        | Sends the chart's rows; number guard                                                            | Labelled AI, no confirm |
| A7  | Market brief         | A one-page brief in English or German                                                                          | Shapley attribution; number guard                                                               | Draft                   |
| A8  | Survey harmonizer    | Build time: maps EAFO answers to the five groups, reasoning written down                                       | Applies the mapping to the microdata; confidence intervals                                      | Mapping sign-off (P4)   |
| A9  | Research agent       | Build time: finds and extracts dated values with passports                                                     | Schema; cross-source checks                                                                     | Data sign-off (G1)      |

Every AI answer has a "show the work" trace (the prompt, each tool call, what it returned) and
a badge on every value it touched. The AI quality page shows, per feature, what it does, its
guardrail, its eval result with a confidence interval and the date of the last run.

## Cuts that pay for the AI focus

- The Europe map becomes a tile grid by market; the map is a stretch.
- Live Monte Carlo stays on demand (D10).
- "Where do I sit?" and "Ask a segment" stay stretch (D12).

## v2 list (not before the freeze)

Shared scenario library (`db`), Spanish UI, in-app refit, Norway as a saturation check,
scrappage and city-access policies, a used-car market.
