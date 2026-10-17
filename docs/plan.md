<!-- Copy of the Tipping Point build plan doc (https://claude.ai/code/artifact/c2faf653-ffe8-4ece-80fd-ed2d74de1419), exported 2026-10-17. The doc is the source of truth; re-export when it changes. -->

# Tipping Point build plan

Oct 17, 2026 · @Nicolas Zauner

Tipping Point forecasts new-car registrations by powertrain (BEV, PHEV, full hybrid, ICE) for Germany, France, Spain, Italy, the Netherlands and Belgium to 2035. It rebuilds your consulting logic from public data: a TCO ratio against ICE, five adopter groups with a switching threshold each, calibrated on EU survey and registration data. AI drafts scenarios, reads policy texts and explains results. Nothing it proposes changes a number until you confirm it, and every number it writes is checked against the model. It's built here on your Pro plan, published as a claude.ai artifact, and frozen with Cut-in on Nov 22, 2026.

## Why this app

A market planner at a carmaker or importer has to answer one question every planning round: how many BEVs, PHEVs, hybrids and combustion cars will we sell in each market, and what happens when a subsidy ends or diesel goes up? Germany shows what's at stake. The Umweltbonus ended in December 2023, the BEV share fell from 18.4% to 13.5% in 2024, then rebounded to 19.1% in 2025. A plan built on a straight trend line got both years wrong.

Tipping Point answers that question with the logic you ran at Deloitte. It uses public data only, and AI handles the work that used to take a research team.

| Role at an OEM or importer                                            | What they decide                                  | What Tipping Point gives them                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Market and product planner (Markt- und Produktplanung), the main user | Powertrain mix per market and year; launch timing | Forecast by market and powertrain to 2035 with P10 to P90 bands; scenario comparison |
| Sales steering and pricing (Vertriebssteuerung)                       | How much discount closes the TCO gap              | Goal seek: the price or bonus needed to reach a target share                         |
| Strategy and CO2 compliance                                           | Whether the forecast mix meets fleet targets      | Share path against the target line, and which levers move it                         |
| Charging and energy partners (secondary)                              | Where public charging falls short                 | Public charging capacity implied under AFIR, per market                              |

The main KPI is forecast accuracy you can check. On a hold-out backtest (2024 and 2025), the model has to beat two naive baselines, last year's share and a linear trend, on mean absolute error in percentage points of BEV share. Three secondary KPIs back it up:

- **Speed:** minutes from a pasted policy text to a scenario that has run, against a manual baseline we ask experts for
- **Number guard:** zero AI sentences carrying a number the model didn't produce
- **Extraction accuracy:** at least 90% of fields right on the policy eval set

It fits the direction you set on 15 October: commercial and market-facing rather than deep engineering. In the fellowship report it becomes the market use case next to Cut-in (supply chain) and the V-model requirements case (R&D). Both prototypes follow the same rule: AI reads and writes language, deterministic code decides. That gives the report one argument with two proofs.

The About page says you built similar models in consulting. The Deloitte name doesn't appear anywhere in the app, and nothing comes from Deloitte's model, data, survey results or parameter values. The method itself is public: TCO comparisons and Rogers' diffusion groups are textbook material.

## How a forecast is built

&#91;embedded content: How a forecast is built · 3 AI steps, 8 code steps\]

Claude touches a forecast in three places, and you stand between each of them and the numbers. Everything from the TCO step to the forecast is tested code.

## The model

The model is plain TypeScript with no AI inside, so the same inputs always give the same forecast. It runs for every market, year (2018 to 2035), vehicle class (small, compact, SUV), buyer type (private with home charging, private without, company car) and powertrain (ICE, FHEV, PHEV, BEV). Money is in real 2025 euros, years are integers and shares are fractions.

### Total cost of ownership

TCO is the present value of owning the car over the holding period T (default six years private, four years company, both editable):

```latex
\mathrm{TCO}_k = P_k - G_k + \sum_{t=1}^{T} \frac{E_{k,t} + M_{k,t} + I_{k,t} + X_{k,t}}{(1+r)^t} - \frac{RV_{k,T}}{(1+r)^T}
```

| Term | Component             | How it's computed                                                                                                                                | Trap we test for                                                                                 |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| P    | Purchase price        | Net list price plus VAT plus registration tax (NL BPM, ES impuesto de matriculación, FR malus, BE regional tax), minus a typical dealer discount | Companies reclaim VAT, private buyers don't                                                      |
| G    | Grants                | Rules per programme: amount by powertrain, price cap, income tier, buyer type, start and end date                                                | Germany's 2026 bonus depends on household income; Spain's Plan Auto+ stops at €45,000 before tax |
| E    | Energy                | km × real-world consumption × price; BEVs mix home, public AC and DC prices by buyer type; PHEVs use a real-world utility factor                 | WLTP uplift, charging losses, l/100 km against kWh/100 km                                        |
| M    | Maintenance and tyres | €/km by powertrain, scaled by country price level                                                                                                | BEV savings counted once, not twice                                                              |
| I    | Insurance             | Share of list price by country and powertrain                                                                                                    |                                                                                                  |
| X    | Taxes and levies      | Annual circulation tax, CO2 price on fuel (BEHG now, ETS2 from 2028), the company-car driver's benefit-in-kind tax                               | Germany exempts BEVs registered by 2030 from Kfz-Steuer, but only until 31 Dec 2035              |
| RV   | Residual value        | Share of list price after T years by powertrain, with a wide range for BEVs                                                                      | Low confidence, so it gets the widest uncertainty band                                           |
| r    | Discount rate         | Real, default 5% private and 6% company                                                                                                          | Nominal sources are deflated with HICP first                                                     |

The ratio against ICE drives everything that follows. R = 1 means equal lifetime cost; R = 1.2 means the BEV costs 20% more.

```latex
R_k = \frac{\mathrm{TCO}_k}{\mathrm{TCO}_{\mathrm{ICE}}}
```

For a company car, the cost is the employer's net cost plus the driver's benefit-in-kind tax, with an editable weight between the two. That's where the 0.25% rule in Germany, bijtelling in the Netherlands and the deductibility rules behind Belgium's BEV boom enter.

### Who switches: the threshold-choice model

Your original logic stays at the core. Each group switches from ICE to BEV once the ratio drops below its threshold, and thresholds inside a group are normally distributed. With BEV as the only alternative, the BEV share in group s is:

```latex
S_{\mathrm{BEV},s} = \Phi\left(\frac{\mu_s - R_{\mathrm{BEV}}}{\sigma_s}\right)
```

Early adopters have a mean threshold above 1 and switch while BEVs still cost more. Laggards sit below 1 and may not switch even at parity.

With three alternatives, independent curves would let one buyer count twice. So each buyer gets a tolerance t, drawn from their group's normal distribution, and each powertrain gets a novelty weight a (BEV 1, PHEV about 0.6, FHEV about 0.2, ICE 0, all calibrated). The buyer picks the powertrain with the highest u:

```latex
u_k = a_k\,(t - 1) - (e_k - 1), \qquad u_{\mathrm{ICE}} = 0, \qquad e_k = R_k\,(1 + h_{k,b})
```

Here e is the effective ratio, and h is a hurdle for barriers that aren't costs, such as having no home charger. With BEV as the only alternative, this reduces exactly to your formula: a buyer picks the BEV when t is above e. An early adopter at t = 1.3 picks a BEV at ratio 1.15 over a hybrid at 0.97 (u = 0.15 against 0.09). A laggard at t = 0.8 needs the BEV below 0.8. In academic terms, it's a reduced-form random-coefficient choice model, which gives the report a citable footing. The app integrates over 201 fixed quantiles of t per group, with no random draws, and breaks ties toward the more conservative powertrain (ICE, then FHEV, PHEV, BEV).

### From shares to volumes, stock and charging

Markets don't jump to the new equilibrium in one year: supply, dealers and model ranges lag. A partial-adjustment step with a fitted speed λ handles that:

```latex
S_y = S_{y-1} + \lambda\,(S^{*}_y - S_{y-1})
```

Volumes are the total market × buyer-type mix × class mix × group sizes × shares. The total market starts from 2025 actuals with editable growth. You can also import your own forecast file (a GlobalData export fits) and the AI maps its columns. The vehicle stock runs from 1 January 2025: plus sales, minus scrappage on a survival curve. From the stock, the app derives the public charging power AFIR requires (at least 1.3 kW per BEV and 0.8 kW per PHEV on the road) and compares it with installed capacity.

### Calibration and backtest

The model fits about ten parameters:

- group means, shared across markets
- one shift per market
- the spread σ
- the PHEV and FHEV novelty weights
- the no-home-charger hurdle
- the adjustment speed λ

They're fitted on BEV, PHEV and hybrid shares for six markets from 2018 to 2023, about 108 data points. The fit is penalised least squares, with priors from the survey groups so the parameters stay plausible. Before any real data goes in, a synthetic recovery test generates shares from known parameters and checks that the fit finds them again. That proves the parameters can be identified at all. The hindcast then fits on data up to 2023 and runs 2024 and 2025 with the inputs that actually happened, such as the end of Germany's bonus. It tests the behaviour model, not our ability to forecast oil prices, and the app says so.

### Uncertainty, goal seek and attribution

- **Uncertainty bands:** Monte Carlo runs 500 Latin-hypercube draws over the uncertain inputs (fuel and electricity prices, BEV price path, residual values, mileage). Each input has a low, likely and high value from its source, and energy prices are correlated (rank correlation 0.5, editable). Runs are seeded so they repeat exactly, run in a web worker, and are shown as P10 to P90 bands.
- **Goal seek:** finds the bonus, price or tax that reaches a target share or stock in a given year. It uses bisection on levers that move the result in one direction only, and says plainly when the target can't be reached within the lever's limits.
- **Attribution:** an exact Shapley split of the difference between two scenarios across six lever groups (64 runs), such as "of +6.2 points, 3.1 come from the bonus". The parts must add up to the total exactly, and a property test checks that.

One deterministic run takes tens of milliseconds. A full Monte Carlo run takes a few seconds in the worker, with a progress bar.

## Consumer groups from EU survey data

The five groups come from the EAFO Consumer Monitor 2023, run for DG MOVE. It covers about 19,000 drivers in 12 countries, including all six of ours. Non-BEV drivers were asked whether they'd consider a BEV as their next car, and the answer options map almost one to one onto Rogers' groups. The respondent-level data is on Zenodo under CC BY-SA 4.0, so we compute the groups per market ourselves instead of copying a published chart.

One correction matters. BEV drivers make up about 15% of the Dutch respondents (324 of 2,221), far above their real share of drivers. So the innovator group comes from the actual BEV share of the car stock in each market, and the survey answers split the rest.

| Group          | Survey answer (non-BEV drivers)                        | Netherlands 2023, illustrative | Starting threshold μ |
| -------------- | ------------------------------------------------------ | ------------------------------ | -------------------- |
| Innovators     | Already drives a BEV (from stock data, not the sample) | about 5%                       | 1.35                 |
| Early adopters | Yes, within 0 to 5 years (25%)                         | 23.8%                          | 1.15                 |
| Early majority | Yes, within 5 to 10 years (8%)                         | 7.6%                           | 1.02                 |
| Late majority  | Yes, no timeframe (19%) plus don't know (19%)          | 36.1%                          | 0.93                 |
| Laggards       | Not buying a BEV (29%)                                 | 27.6%                          | 0.80                 |

The Dutch figures are the answer shares from the country report multiplied by the 95% who don't drive a BEV. The starting thresholds are priors; calibration moves them. Rogers' textbook split (2.5, 13.5, 34, 34, 16%) stays available as a reference toggle, so a viewer can see how much the real survey data changes the forecast.

Two limits go on the Segments screen in plain words. The panel is licensed drivers rather than new-car buyers, who skew older, wealthier and more often drive company cars. And stated intentions overshoot actual purchases. The market shift in the calibration absorbs both, and the backtest shows whether that's enough.

The 2025 edition (fieldwork October 2025, EU-27, about 3,000 respondents) is too thin per country to rebuild the groups. We use it to show how attitudes moved since 2023, and as a check on the direction of the calibrated shift.

## Data

Every input is public, dated and sourced, and the app shows that for each value. Every value is stored with what I call its passport: unit, source, link, retrieval date, confidence, and a low and high value. The schema rejects any value without a source, so nothing undocumented gets into a build. Confidence also sets the spread in the Monte Carlo run, so the weakest inputs, such as BEV residual values, widen the bands the most.

| Input                                         | Source                                                                                                                                        | Detail                                                       | How we get it                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| New registrations by powertrain, 2018 to 2025 | ACEA annual releases, cross-checked with KBA (DE), PFA/AAA Data (FR), ANFAC (ES), UNRAE (IT), RAI/BOVAG (NL), FEBIAC (BE)                     | Annual, six markets                                          | I fetch and cross-check; national and ACEA figures must agree within 2%                                    |
| Full against mild hybrids                     | National sources where they split them                                                                                                        | ACEA's hybrid figure includes mild hybrids                   | Labelled assumption elsewhere; the backtest scores the combined hybrid share so the split can't flatter it |
| Total market                                  | 2025 actuals with editable growth                                                                                                             | You can import your own forecast file                        | Built in, plus a CSV import                                                                                |
| Vehicle stock by powertrain, 1 Jan 2025       | ACEA vehicles-in-use report, KBA stock data                                                                                                   | Six markets                                                  | I fetch                                                                                                    |
| Fuel prices with taxes                        | EU Weekly Oil Bulletin                                                                                                                        | Weekly since 2005, used as annual averages                   | You download the history file                                                                              |
| Household electricity prices                  | Eurostat nrg\_pc\_204, band DC, all taxes included                                                                                            | Twice a year                                                 | You download a CSV                                                                                         |
| Public AC and DC charging prices              | Operator price lists (EnBW, Ionity, Iberdrola, Fastned and others)                                                                            | Dated snapshot, medium confidence                            | I fetch                                                                                                    |
| Purchase price by class and powertrain        | Manufacturer configurators, two or three reference models averaged per cell                                                                   | 3 classes × 4 powertrains; no small PHEV, marked unavailable | I fetch, dated                                                                                             |
| Price paths to 2035                           | BNEF battery survey ($108/kWh in 2025) and published price-parity studies                                                                     | Index per powertrain                                         | Sourced reference path; AI drafts alternative narratives                                                   |
| Consumption and PHEV utility factor           | Type-approval values, a real-world uplift, ICCT and Fraunhofer PHEV usage studies                                                             | Private and company PHEVs differ sharply                     | I fetch                                                                                                    |
| Taxes: registration, annual, company car, VAT | ACEA tax guide plus national rules                                                                                                            | Rules per country, simplified and labelled                   | You download the guide; I write the rules                                                                  |
| Grants, current and since 2018                | EAFO incentive pages, programme texts (Germany's 2026 bonus, Spain's Plan Auto+, France's bonus écologique, the Netherlands' SEPP and others) | Effective dates matter for the backtest                      | I fetch; the policy reader handles new ones                                                                |
| CO2 price on fuel                             | Germany's BEHG corridor; ETS2 from 2028 with a safeguard around €45/t                                                                         | Path to 2035                                                 | I fetch                                                                                                    |
| Maintenance and insurance                     | ADAC Autokosten as the German reference, scaled by Eurostat price levels                                                                      | Per powertrain                                               | I fetch                                                                                                    |
| Residual values                               | Public residual-value studies                                                                                                                 | Low confidence, wide range                                   | I fetch                                                                                                    |
| Mileage                                       | National travel surveys                                                                                                                       | Private and company separately                               | I fetch                                                                                                    |
| Consumer groups                               | EAFO Consumer Monitor 2023 microdata and country reports; 2025 aggregate report                                                               | Six markets                                                  | You download                                                                                               |
| Home-charging access                          | EAFO parking question plus Eurostat dwelling type (house or flat)                                                                             | Sets the buyer-type mix                                      | You download one table                                                                                     |
| Deflator                                      | Eurostat HICP, annual                                                                                                                         | To real 2025 euros                                           | You download one table                                                                                     |
| Public charging installed                     | EAFO                                                                                                                                          | For the AFIR comparison                                      | I fetch                                                                                                    |

### Your download list (about 20 minutes, once)

Neither this workspace nor the shell on your computer can reach Zenodo, Eurostat or the Commission's download servers; the proxy refuses them. Download these in your browser into a new folder `AI Fellowship\Tipping Point\data-raw\`, and send "TP P4" when they're there. If you'd rather not, I can do the same through Claude in Chrome with you watching.

- [ ] [EAFO 2023 microdata on Zenodo](https://zenodo.org/records/14523769): EAFO Germany, France, Spain, Italy, The Netherlands, Belgium and "EU (all data)" (seven HTML files, about 6 MB)
- [ ] [EAFO Consumer Monitor page](https://alternative-fuels-observatory.ec.europa.eu/consumer-portal/consumer-monitor): the 2023 country reports for the same six countries (PDF)
- [ ] [EAFO Consumer Monitor 2025 report](https://op.europa.eu/en/publication-detail/-/publication/3826dbdc-2ca6-11f1-906d-01aa75ed71a1) (PDF)
- [ ] EU Weekly Oil Bulletin, "prices with taxes" history since 2005 (xlsx, energy.ec.europa.eu)
- [ ] Eurostat nrg\_pc\_204, household electricity prices, CSV for the six countries
- [ ] Eurostat prc\_hicp\_aind (annual inflation) and ilc\_lvho01 (house or flat), CSV
- [ ] ACEA tax guide 2025 (free PDF on acea.auto)

If a file is missing or in a different format than expected, TP P4 starts with a short check and tells you exactly what to fetch instead.

## Where AI is used, and where it isn't

AI translates between people and the model; the model does the maths. Three jobs go to Claude inside the app, two are stretch goals, and one happens only at build time.

| Job                                        | Model tier               | In and out                                                                                                                                                                 | Guardrail                                                                                                                                           | Without AI                                                 |
| ------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Scenario copilot                           | Default, with page tools | A question or a story ("China price war from 2027") in; a lever diff out, then a run and an answer                                                                         | Closed lever catalogue with limits per lever; you confirm the diff before anything runs; tools are read-only; number guard on the answer            | Scenario studio with sliders, plus the six saved scenarios |
| Policy reader                              | Default                  | Pasted rule text in German, Spanish, French, Italian, Dutch or English in; grant or tax levers out (amount, powertrain, price cap, income tier, buyer type, start and end) | Each field quotes its source passage, which must appear word for word in the text; amounts and dates checked against limits; you confirm each field | Manual lever form; curated programmes already loaded       |
| Market brief                               | Default                  | The scenario results and the attribution in; a one-page brief in English or German out                                                                                     | Number guard: every number, year and percentage must exist in the results, or it's flagged and highlighted; always labelled draft                   | Template brief                                             |
| Forecast file mapper (stretch)             | Quick                    | The first 20 rows of a pasted CSV in; a column mapping out                                                                                                                 | Preview and confirm; values parsed by code, never by the model                                                                                      | Manual column picker                                       |
| Ask a segment (stretch)                    | Quick                    | A persona card built from one group's survey answers in; a chat out                                                                                                        | Labelled "simulated persona"; never shows a number that isn't on the card; never feeds the model                                                    | Hidden                                                     |
| Data curation (build time, not in the app) | This workspace           | Source pages and files in; dated values with passports out                                                                                                                 | Every value cites a page I actually opened; validate-data review; you sign off                                                                      | Not applicable                                             |

The copilot works in two steps, because a tool call can't wait for you. First Claude returns a structured lever diff, shown as a receipt ("ES: BEV bonus €4,500 → €0 from 2027; diesel +€0.15/l"). Once you confirm, a second call gets read-only page tools and answers from what they return:

- `run_scenario`
- `compare`
- `goal_seek`
- `explain_drivers` (the Shapley split)
- `get_inputs` (values with their passports)

Tool results stay small, and the trace shows each run as it happens. A call on the default tier takes 30 to 90 seconds, so the guided tour replays stored, reviewed transcripts. Live AI is for people exploring on their own.

Pasted text is treated as data. The prompt says so, the output schemas can't express a command, and nothing the model returns changes a number until you confirm it. The eval set includes a programme text with an instruction planted in it.

On your question about AI forecasting costs: the model doesn't guess prices. Many of the big moves are scheduled by law, such as the end of the Kfz-Steuer exemption, ETS2 from 2028 and Germany's bonus to 2029. Those enter as sourced trajectories. For the rest, the copilot drafts scenario stories with consistent lever sets, and you accept or edit them. The uncertainty comes from Monte Carlo runs in code. That keeps the line Graessner drew: you don't spend tokens on what you can program.

Live AI runs through the claude.ai `sample` capability, on each viewer's own Claude plan, with no API key and no extra bill. The first call asks for consent. A visitor without Claude, or the offline copy, gets the full model and stored examples, and every AI control is hidden. Every value carries a badge saying who produced it: data, model, AI confirmed by you, or your override.

A hidden Eval page measures quality with 20 policy texts with hand-checked answers. Six are real programme texts, one per market in its own language. Fourteen are hard cases: amendments, income tiers, percentage-based grants like Plan Auto+, negations, two programmes in one text, a mixed-language text and the planted instruction. On top of that come 15 copilot questions with expected lever diffs. The targets are at least 90% field accuracy, 100% valid source passages and zero number-guard escapes. The measured result goes into the report as it comes out.

## Six demo scenarios

Six scenarios carry the demo, and their full outputs are golden snapshots. Each tests one part of the model a market planner would doubt first.

| #   | Scenario           | Market        | What changes                                                                                                                         | What it shows                                                                                                                                                            |
| --- | ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Bonus cliff        | DE            | Hindcast: fitted on data to 2023, then the bonus ends on 17 Dec 2023                                                                 | Predicted against actual: 18.4% → 13.5% → 19.1% BEV share, and the error against the naive baselines                                                                     |
| S2  | Plan Auto+         | ES            | Grants as a share of a maximum, the €45,000 pre-tax price cap and the EU-assembly bonus                                              | The cap cuts off the pricier BEVs, so the SUV class reacts differently from the compact class; goal seek finds the bonus needed for a target share in 2030               |
| S3  | Company cars       | BE against DE | Belgium's deductibility rules against Germany's 0.25% rule; the proposed EU company-fleet requirements from 2030 as a lever          | The company channel moves first, and why Belgium's BEV share left Germany's behind                                                                                       |
| S4  | China price war    | All six       | BEV net prices 15% lower from 2027 in the small and compact classes                                                                  | Which group tips first in which market: the signature tipping-point view                                                                                                 |
| S5  | 2035 softened      | All six       | The Commission's 90% CO2 target instead of 100% keeps PHEVs and range extenders after 2035; smaller OEM compliance discounts on BEVs | The long-run mix, with PHEVs surviving; the plenary vote in November is a live test for the policy reader                                                                |
| S6  | Oil shock and ETS2 | All six       | Fuel prices up 40% in 2027; ETS2 from 2028 at its roughly €45/t safeguard                                                            | ETS2 adds about €0.10 per litre of petrol before VAT. In Germany it would replace a BEHG price that's already above €45/t, so fuel could even get slightly cheaper there |

S6 is the kind of result that makes the case for a model over gut feeling: the same EU rule pushes BEVs in five markets and slightly helps petrol cars in the sixth. Its exact size depends on how Germany moves from BEHG to ETS2. That rule is curated in TP P6, and the scenario cites it.

## Architecture and stack

Tipping Point uses Cut-in's architecture: one self-contained HTML file, built with Vite and published as a claude.ai artifact. That means no server, no API key and no hosting bill, and the same file runs offline on your laptop. The model is a pure TypeScript module with no React, clock, randomness or I/O, and a lint rule stops the UI from reaching around it. The UI makes one call, `forecast(inputs, scenario, params)`, and gets the whole forecast back. Monte Carlo and calibration run in a web worker so the page never freezes.

| Layer         | Choice                                                                                                                                         | Why                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Build         | Vite 8 with vite-plugin-singlefile, same pins as Cut-in                                                                                        | One file for the artifact and the offline copy                                           |
| UI            | React 19, TypeScript strict (unchecked index access and exact optional types on)                                                               | Same family as Cut-in and your portfolio                                                 |
| Styling       | Tailwind CSS 4; components hand-written on Radix primitives, copied from Cut-in                                                                | The shadcn registry is blocked from this workspace                                       |
| State         | Zustand; results derived by memoised selectors, never stored twice                                                                             | One source of truth, no stale numbers                                                    |
| Charts        | Hand-drawn SVG with d3-scale and d3-shape                                                                                                      | The tipping-point view needs draggable lines and bands that chart libraries make awkward |
| Map           | topojson-client with world-atlas outlines, bundled                                                                                             | Europe small multiples; the frame has no network                                         |
| Maths         | Our own normal CDF and quantile, seeded xoshiro random generator, Nelder–Mead fitter and Latin hypercube, each tested against reference values | Small, auditable, no unmaintained dependencies                                           |
| Worker        | Vite inline worker, with a main-thread fallback if the frame blocks workers (spike in TP P1)                                                   | Responsive page during heavy runs                                                        |
| Validation    | Zod 4                                                                                                                                          | Every data file at load, every AI answer                                                 |
| Excel         | write-excel-file                                                                                                                               | Assumptions workbook and the Excel twin, without the vulnerable npm `xlsx` package       |
| Tests         | Vitest, Testing Library, fast-check, Playwright on the preinstalled Chromium, axe-core                                                         | Unit, property, golden, end-to-end, accessibility                                        |
| Data pipeline | TypeScript scripts (tsx) from raw files to passport JSON, committed                                                                            | One language and one type system end to end                                              |

Versions get re-checked on npm in TP P1 and pinned exactly. Where Cut-in's ADR-001 already settled a deviation (TypeScript 5.9.3, ESLint 9.39.5), we keep it.

From Cut-in we copy rather than share the publish script, the pre-publish check, the design tokens and components, i18n, the `sample` wrapper with its fake for tests, the number guard and the Playwright harness. A shared package would tie the two freezes together; ADR-002 records the choice. The pre-publish check gets two more banned strings: "Deloitte" (your framing choice) and the two anonymised interviewees, as in Cut-in.

```text
tipping-point/
  CLAUDE.md          rules for every session (commands, invariants, units, framing)
  docs/              plan, scope, model spec, domain glossary, segments, data report, ADRs, eval results
  scripts/           EAFO parser, data build, calibration, Excel twin, publish and pre-publish checks
  src/
    domain/          types, branded units, lever catalogue
    model/           tco, adoption, market, stock, charging, calibrate, montecarlo, goalseek, shapley, rng, normal
    data/            passport JSON per market, curated programmes, stored AI examples
    ai/              prompts, Zod schemas, sample wrapper, page tools, number guard, span check
    worker/          Monte Carlo and calibration entry points
    ui/              components, screens, tour, i18n (en, de)
  tests/             unit, property, golden, recovery, e2e, a11y
```

The app declares two capabilities: `sample` (live AI with page tools) and `downloads` (assumptions workbook, scenario JSON, brief as Markdown). Browser storage holds only per-viewer conveniences such as language, theme and your own saved scenarios, each read and write wrapped in try/catch. A scenario library shared between viewers would need the `db` capability and signed-in viewers, so it's on the v2 list. The code lives in a private repo, `NicolasZauner/tipping-point`, and every prompt ends with a push, because this workspace gets wiped after inactivity.

## Screens and interactions

The best demo moment is the tipping-point view, and the app is built around it. Five bell curves, one per group, sit on a TCO-ratio axis, and a vertical line marks today's BEV ratio for the chosen market, class and buyer type. The shaded area under each curve is the people who switch. Drag the year slider and the line slides left as costs fall, and you watch early adopters tip, then the early majority. It's your Deloitte logic made visible in one picture.

| Screen           | What it shows                                                                                                                                                     | Demo moment                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Overview         | Europe small multiples coloured by BEV share; a tile per market with BEV share in 2030, TCO parity year per buyer type and the gap to target; a scenario switcher | Press play: 2018 to 2035 in ten seconds, map and tiles moving together            |
| Market           | Stacked shares by powertrain, 2018 to 2035: history solid, forecast with P10 to P90 bands; volumes and stock tabs; AFIR charging gap                              | The 2024 dip in Germany, and the band widening after 2030                         |
| TCO lab          | Cost waterfall per powertrain for one market, class and buyer type; the ratio over time with the parity year marked; every bar shows its source on hover          | "Why is a BEV cheaper for a Belgian company car than for a Spanish flat-dweller?" |
| Tipping point    | The five curves, the draggable ratio line, group sizes from the survey, and a Rogers toggle                                                                       | Drag the line; watch who switches                                                 |
| Scenario studio  | Levers grouped into prices, energy, taxes, grants and behaviour; a path editor per lever with year handles; two scenarios side by side with Shapley bars          | "Of +6.2 points, 3.1 come from the bonus"                                         |
| Copilot          | Side drawer (Cmd+J): chat, the lever-diff receipt with Confirm, a live trace of tool runs, the answer with number badges                                          | Ask about Spain without the bonus; it proposes, you confirm, it runs              |
| Policy reader    | Pasted text on the left with highlighted passages, extracted fields on the right; hovering a field lights up its source                                           | Paste the Plan Auto+ text; the price cap and percentages land as levers           |
| Backtest         | Predicted against actual per market, with the hold-out years shaded and an error table against the naive baselines                                                | Answers the first expert question: why trust this?                                |
| Segments         | Group sizes per market, the survey wording, the mapping, the limits; "ask a segment" chat (stretch)                                                               | Laggards in Spain against the Netherlands                                         |
| Data and sources | Every input with its passport, confidence and date; download the assumptions workbook                                                                             | The Deloitte-style audit trail, in Excel                                          |
| Brief            | The generated one-page market brief with number-guard status; download as Markdown                                                                                | A brief a planning team could circulate                                           |
| How it works     | What's AI and what's code, the method in plain words, "inspired by models I built in consulting", data licences                                                   | Fills the About slot                                                              |

Five features run across all screens:

- **Number passport:** hover any number to see its source and how it was computed.
- **Guided tour:** three minutes, with a presenter mode (larger type, no chrome).
- **Command palette (Cmd+K):** jump to a market or scenario, switch language or theme, start the tour.
- **Language:** English and German for every label, rule and explanation.
- **Where do I sit? (stretch):** six questions about your own driving and charging place you on the curves, with your personal TCO.

The look is the same family as Cut-in and your portfolio, so the two prototypes read as a set. It's monochrome on the zinc scale with one accent colour, different from Cut-in's, picked in TP P11. Text is Inter and numbers are JetBrains Mono, on rounded cards. The four powertrains keep fixed colours across every chart, checked for colour blindness with the dataviz validator, and every series is also labelled directly. Light and dark mode follow the system. The layout is built for 1280 px and up, works on a tablet, and stacks on a phone, with charts scrolling inside their frames so the page never scrolls sideways. Every chart has a data-table alternative, and the target is WCAG 2.1 AA.

## Quality plan

The model gets tested harder than the screens, because a wrong share costs more than a misaligned button. A forecast can't change without anyone noticing: the golden tests stop the build until you and I have looked at the difference.

| Layer          | What it catches                                                                                                                                                      | How                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types          | Litres added to kilowatt-hours, euros passed as shares                                                                                                               | Branded types: `Eur`, `Share`, `Year`, `LPer100Km`, `KWhPer100Km`, `Km`                                                                                                                                                                                                                                                                                                                                        |
| Data checks    | Missing passports, shares not summing to 100%, ACEA and national figures disagreeing, nominal values left undeflated                                                 | Zod plus cross-source checks on every generated file; one review with the validate-data skill                                                                                                                                                                                                                                                                                                                  |
| Excel twin     | Formula bugs in TCO                                                                                                                                                  | One reference case per market rebuilt in Excel with live formulas; the TypeScript result must match within one cent. You can audit the maths in Excel, the way you'd check a consulting model                                                                                                                                                                                                                  |
| Unit tests     | Edge cases: a grant ending mid-year, a price exactly at the cap, a class with no PHEV, zero mileage, the 2035 tax cliff, the holding period running past the horizon | Vitest, written test-first                                                                                                                                                                                                                                                                                                                                                                                     |
| Property tests | Bugs nobody thought of, found on 1,000+ random cases per property                                                                                                    | fast-check: shares between 0 and 1 and summing to 1; a cheaper BEV never lowers BEV share; one alternative reduces exactly to your Φ formula; early adopters never switch less than laggards; scaling all costs leaves shares unchanged; λ = 1 equals the static model; stock is conserved; Shapley parts sum to the total; Monte Carlo with zero spread equals the plain run; goal seek reproduces its target |
| Recovery test  | A fitter that "works" on parameters it can't identify                                                                                                                | Generate shares from known parameters, fit, recover them within tolerance                                                                                                                                                                                                                                                                                                                                      |
| Golden tests   | Any change to the six scenarios or the backtest                                                                                                                      | Snapshots you've reviewed                                                                                                                                                                                                                                                                                                                                                                                      |
| AI layer       | Invented numbers, fake source passages, malformed output                                                                                                             | Zod on every answer; word-for-word passage check; number guard tested with planted wrong numbers; a fake `sample` replaying fixtures and every error code; the Eval page                                                                                                                                                                                                                                       |
| Components     | Broken interactions                                                                                                                                                  | Testing Library: dragging the ratio line, confirming a lever diff, the language switch                                                                                                                                                                                                                                                                                                                         |
| End to end     | Anything broken in the built file                                                                                                                                    | Playwright on the single HTML file: the tour, every screen, a scenario edit, a Monte Carlo run, the downloads; once without AI and once with the fake `sample`                                                                                                                                                                                                                                                 |
| Accessibility  | Contrast, labels, keyboard traps                                                                                                                                     | axe-core on every screen (zero serious findings) plus a keyboard-only run                                                                                                                                                                                                                                                                                                                                      |
| Visual check   | Layouts that pass tests but look wrong                                                                                                                               | Screenshots of every screen in light and dark, desktop and phone, which I look at before each publish                                                                                                                                                                                                                                                                                                          |
| Performance    | A page that hangs                                                                                                                                                    | One deterministic run under 50 ms; 500 Monte Carlo draws under 5 s in the worker                                                                                                                                                                                                                                                                                                                               |
| Pre-publish    | Things that must never ship                                                                                                                                          | Bundle under 3 MB, no external URLs, no banned names, no console errors                                                                                                                                                                                                                                                                                                                                        |

A few conventions remove whole classes of bugs before they're written:

- **Units:** money is real 2025 euros, years are integers, shares are fractions, and every unit conversion lives in one tested module.
- **No clock in the model:** the model never touches `Date`, and randomness only comes from a seeded generator that's passed in.
- **Guards:** every division is guarded, NaN is an error rather than a value, every sort has an explicit tie-breaker, and every switch over powertrains or buyer types is exhaustive.
- **Strings:** every UI string goes through the i18n dictionary, and a test checks that English and German have the same keys.

A prompt is done when typecheck, lint and every test pass, model coverage is at least 95% of lines and 90% of branches, any golden difference has been reviewed, the code is pushed, the changelog has a line, and you've seen a screenshot of anything visual that changed. A separate agent that hasn't seen the code reviews the model against the written spec twice: after TP P10 and before the freeze.

## Skills, connectors and plugins

About 35 of your installed skills earn a place in this build, and none of your connectors is needed inside the app. GitHub works through this workspace's command line, the way it does for Cut-in.

| Skill or tool                                                                     | From                 | What it does here                                                                                       | Prompts                |
| --------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| grilling                                                                          | Matt Pocock plugin   | Stress-tests scope and modelling choices before code                                                    | P2                     |
| domain-modeling                                                                   | Matt Pocock plugin   | Glossary (Gesamtkosten, Markthochlauf, Restwert, geldwerter Vorteil), entities, invariants              | P3                     |
| prototype                                                                         | Matt Pocock plugin   | A throwaway script to check the choice rule behaves before we commit to it                              | P3                     |
| tdd                                                                               | Matt Pocock plugin   | Test-first model code                                                                                   | P7 to P10              |
| codebase-design                                                                   | Matt Pocock plugin   | Keeps the model a deep module behind one call                                                           | P10                    |
| code-review, diagnosing-bugs                                                      | Matt Pocock plugin   | Reviews against the spec; the fix loop for hard bugs                                                    | P10, P18, P19          |
| writing-for-agents                                                                | Matt Pocock plugin   | A CLAUDE.md that keeps every session on the rules                                                       | P1                     |
| architecture, system-design                                                       | Engineering plugin   | ADRs and the model's interface                                                                          | P1, P3                 |
| testing-strategy, code-review, tech-debt, deploy-checklist, documentation         | Engineering plugin   | Test plan, review, freeze checklist, README and report docs                                             | P7, P10, P14, P19, P20 |
| explore-data, validate-data, statistical-analysis                                 | Data plugin          | Parsing the EAFO data, checking curated inputs, calibration and eval statistics                         | P4 to P6, P9, P17      |
| deep-research                                                                     | Built-in             | Fans out the source search for six markets' prices, taxes and grants                                    | P5, P6                 |
| file-reading, pdf-reading                                                         | Built-in             | EAFO country reports and the ACEA tax guide                                                             | P4, P5                 |
| xlsx                                                                              | Built-in             | Assumptions workbook and the Excel twin                                                                 | P5, P7                 |
| dataviz                                                                           | Built-in             | Every chart: form, palette validator, marks, interaction                                                | P11 to P13, P20        |
| artifact-design, artifact-capabilities                                            | Built-in             | Page contract; `sample` with page tools and `downloads`                                                 | P1, P11, P15, P16      |
| frontend-design                                                                   | Your skill           | Aesthetic direction so it doesn't look templated                                                        | P11                    |
| design-system, ui-ux-pro-max, ui-styling                                          | UI UX Pro Max plugin | Tokens, chart and interaction guidelines                                                                | P11 to P13             |
| ux-copy, accessibility-review, design-critique, user-research, research-synthesis | Design plugin        | Microcopy in two languages, the WCAG pass, a critique round, the expert test kit, synthesis of feedback | P12 to P14, P17, P18   |
| claude-in-chrome                                                                  | Built-in             | A GIF of the tour in your Chrome; downloads if you'd rather not do them by hand                         | P4, P14                |
| Slides and Docs artifact types                                                    | Built-in             | Fellowship slides and the report section                                                                | P20                    |
| Gmail connector                                                                   | Your connectors      | Drafts for the expert test messages, sent only by you                                                   | P17                    |
| cv-tailoring                                                                      | Your skill           | The CV bullet for Tipping Point once it's frozen                                                        | December               |

What we skip, and why:

| Tool                                                              | Why not                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Lovable                                                           | Costs credits, and gives us less control over the model and its tests                                   |
| web-artifacts-builder                                             | Its shadcn setup needs the registry this workspace can't reach; Cut-in's pipeline already works         |
| Canva, Higgsfield, canvas-design, theme-factory, brand-guidelines | Visual or Anthropic-brand tools; the app has its own design system                                      |
| Finance plugin, budget-dashboard                                  | Accounting and personal-budget tools, not a TCO or forecasting model                                    |
| ClickUp, Notion, Google Calendar, Google Drive                    | The task list and this doc track the work; nothing to sync                                              |
| DeepL                                                             | The policy reader handles languages inside the app; you write the German UI copy yourself or check mine |
| mcp-builder, skill-creator, cowork-plugin tools                   | No server or plugin to build; CLAUDE.md carries the session rules                                       |
| Microsoft 365                                                     | Blocked until IESE IT grants access, and not needed                                                     |

## Timeline

Five weeks to the shared freeze is tight, so the light work comes first. Data and model prompts run while Cut-in finishes its Expo build, and the screen-heavy prompts start once the Expo is over. The report assets follow in December.

&#91;embedded content: Build timeline · Tipping Point next to Cut-in, 4 gates\]

Each gate has a check you can see: data signed off, the six scenarios and the backtest reviewed, v0.8 live with experts testing, and the freeze. If a gate slips, scope shrinks in the order the risk table sets and the date holds.

## Prompt playbook

Twenty prompts take Tipping Point from an empty repo to the report, each sized for one working session. The prefix "TP" keeps them apart from Cut-in's P-numbers. You send the text in the second column. I then:

1. pull the repo and read `CLAUDE.md` and `docs/plan.md` (a copy of this doc)
2. load the skills listed for that prompt and do the work
3. push the result and copy what you should see into `AI Fellowship\Tipping Point\`
4. reply with what changed, what I tested and what you need to check

If a usage limit cuts a prompt off, send "Continue TP P\<number>" and I pick up from the last push. On a day you work on both apps, run the Cut-in prompt first: it has the earlier deadline.

Before TP P1, take two minutes: create an empty private repo `tipping-point` under NicolasZauner on GitHub (no README, no licence), and a folder `AI Fellowship\Tipping Point\` with a `data-raw` folder inside.

### Foundation (18 to 26 Oct)

| #     | Send this                                                                                                                                                                                                                                                  | Skills I load                                                                                          | You get                                                                                                                                                                                 | Your check                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| TP P1 | "Tipping Point P1: set up. The repo NicolasZauner/tipping-point is empty. Scaffold it from Cut-in's setup, pin versions, write CLAUDE.md and ADR-001/002, spike a web worker and `sample` with page tools inside the artifact frame, and publish a shell." | engineering:architecture, mattpocock-skills:writing-for-agents, artifact-capabilities, artifact-design | Repo, `CLAUDE.md`, `docs/plan.md`, a shell artifact, and the spike result (do workers and page tools work in the frame?)                                                                | Open the link on laptop and phone, signed in and in a private window (10 min)                           |
| TP P2 | "TP P2: grill me on the scope."                                                                                                                                                                                                                            | mattpocock-skills:grilling                                                                             | `docs/scope.md`: holding periods, discount rates, horizon (2035 or 2040), classes, how to split full and mild hybrids, company-car treatment, which programmes go into history, v2 list | Answer 15 to 25 questions and sign off (30 min)                                                         |
| TP P3 | "TP P3: domain model and model spec."                                                                                                                                                                                                                      | mattpocock-skills:domain-modeling, mattpocock-skills:prototype, engineering:system-design              | `docs/domain.md` (German and English glossary), `docs/model-spec.md` with every formula and a worked example, `src/domain/types.ts`, and a throwaway check of the choice rule           | Does the maths match how you ran it in consulting? The most important review of your expertise (25 min) |
| TP P4 | "TP P4: the raw files are in data-raw. Parse EAFO and build the groups."                                                                                                                                                                                   | file-reading, pdf-reading, data:explore-data, data:statistical-analysis                                | Parsed microdata, group sizes per market with confidence intervals, the mapping table, `docs/segments.md`                                                                               | Is the mapping sensible for Spain and Belgium? (15 min)                                                 |
| TP P5 | "TP P5: curate inputs, part 1 (DE, FR, ES)."                                                                                                                                                                                                               | deep-research, data:validate-data, xlsx, pdf-reading                                                   | Passport JSON for three markets, the assumptions workbook, a data report with open doubts                                                                                               | Scan the workbook; flag any number your gut disagrees with (20 min)                                     |
| TP P6 | "TP P6: curate inputs, part 2 (IT, NL, BE) plus history from 2018."                                                                                                                                                                                        | deep-research, data:validate-data, xlsx                                                                | All six markets, programme history with effective dates, registrations 2018 to 2025 cross-checked                                                                                       | Gate G1: sign off the data (20 min)                                                                     |

### Model (26 Oct to 6 Nov)

| #      | Send this                                                                                           | Skills I load                                                                             | You get                                                                                                       | Your check                                                                 |
| ------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TP P7  | "TP P7: TCO engine test-first, with the Excel twin."                                                | engineering:testing-strategy, mattpocock-skills:tdd, xlsx                                 | TCO module, `docs/testing.md`, an Excel twin with live formulas matching to the cent                          | Open the twin; check one market against your intuition (15 min)            |
| TP P8  | "TP P8: adoption, market, stock and charging, test-first."                                          | mattpocock-skills:tdd                                                                     | The threshold-choice model, dynamics, volumes, stock, AFIR, property tests                                    | German tipping points for 2026 in plain words (10 min)                     |
| TP P9  | "TP P9: calibration and backtest."                                                                  | data:statistical-analysis, mattpocock-skills:tdd                                          | Recovery test, the fitted parameters, the hindcast for 2024 and 2025 against the baselines, a one-page result | The second most important review: does the backtest convince you? (30 min) |
| TP P10 | "TP P10: scenarios, Monte Carlo, goal seek, attribution, golden S1 to S6, and a fresh-eyes review." | mattpocock-skills:codebase-design, mattpocock-skills:code-review, engineering:code-review | The six scenarios as goldens, the worker, the review findings and fixes                                       | Gate G2: read the six results line by line (30 min)                        |

### Interface (6 to 15 Nov)

| #      | Send this                                                                                         | Skills I load                                                                                                             | You get                                                                                                                        | Your check                                                        |
| ------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| TP P11 | "TP P11: design system and app shell."                                                            | artifact-design, frontend-design, ui-ux-pro-max:design-system, dataviz                                                    | Tokens, components, the powertrain palette, routing, both languages, How it works, republished                                 | Pick the accent from three options; look on your phone (15 min)   |
| TP P12 | "TP P12: overview, market view and TCO lab."                                                      | dataviz, ui-ux-pro-max:ui-ux-pro-max, design:ux-copy                                                                      | Three screens on the real model                                                                                                | Press play on the overview; open Germany (15 min)                 |
| TP P13 | "TP P13: tipping point, scenario studio, backtest, segments, data and sources."                   | dataviz, design:ux-copy, ui-ux-pro-max:ui-styling                                                                         | The rest of the non-AI app                                                                                                     | Drag the ratio line in three markets (15 min)                     |
| TP P14 | "TP P14: tour, presenter mode, end-to-end and accessibility pass, expert test kit, publish v0.8." | design:accessibility-review, design:design-critique, design:user-research, engineering:deploy-checklist, claude-in-chrome | v0.8 artifact, an offline copy, the tour GIF, a five-task test script per expert, ready-to-send messages in German and Spanish | Gate G3: run the tour, share the link, send the messages (30 min) |

### AI and freeze (15 to 22 Nov)

| #      | Send this                                                                           | Skills I load                                                                                                   | You get                                                                                           | Your check                                                               |
| ------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| TP P15 | "TP P15: policy reader with live AI."                                               | artifact-capabilities, design:ux-copy                                                                           | Extraction with passage highlighting, every error state, fake-AI end-to-end tests                 | Paste one real programme text inside claude.ai (10 min)                  |
| TP P16 | "TP P16: scenario copilot with page tools, and the market brief with number guard." | artifact-capabilities, design:ux-copy                                                                           | The two-step copilot, the tool trace, the brief, stored transcripts for the tour                  | Ask it two questions of your own (15 min)                                |
| TP P17 | "TP P17: eval set and eval page."                                                   | data:statistical-analysis                                                                                       | 20 policy texts and 15 copilot questions with checked answers, accuracy with confidence intervals | Run the eval once inside claude.ai, about 35 calls on your plan (15 min) |
| TP P18 | "TP P18: fix round" plus the expert feedback                                        | design:research-synthesis, mattpocock-skills:diagnosing-bugs                                                    | Fixes, each tied to the feedback behind it                                                        | Approve the list (10 min)                                                |
| TP P19 | "TP P19: harden and freeze."                                                        | mattpocock-skills:code-review, engineering:tech-debt, design:accessibility-review, engineering:deploy-checklist | v1.0 artifact, a `v1.0` tag, release notes, a second fresh-eyes model review                      | Gate G4: final click-through (20 min)                                    |

### Report (December)

| #      | Send this                | Skills I load                                                                        | You get                                                                                                                                    | Your check                 |
| ------ | ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| TP P20 | "TP P20: report assets." | dataviz, engineering:documentation, the Slides and Docs artifact types, cv-tailoring | Screenshots, the tour GIF, the backtest chart, architecture picture, eval results, a public-ready README, slides for the club, a CV bullet | Review the slides (30 min) |

Your review time across the twenty prompts adds up to a little over six hours. TP P3, P9 and P10 are the ones to do when you're fresh.

## Expert validation and the report

The expert test runs on v0.8 from 15 November, so feedback lands before the fix round. Each tester gets a five-task script: find Germany's tipping year for company cars, explain the 2024 dip, run Spain without a bonus, paste a programme text, and say what they'd need before trusting the numbers. Four kinds of tester fit, and most are already on your target list:

- **Former Deloitte colleagues** from the automotive team are the sharpest critics of the method and the warmest contacts. Ask them about the method only, not about the firm's model.
- **Eva Pallarés (SEAT)**, already a target, is closest to the main user: market planning at a carmaker, in Barcelona.
- **Daniel González Arias (Accenture, ex DEKRA)** brings the commercial view you wanted him for.
- **Lukas Schriewer (P3) and Johannes Pallasch (NOW GmbH)**: the Leitstelle models the charging ramp-up for Germany, so the AFIR output gives you a concrete reason to write to them in German.

That also helps with the five coffee chats the fellowship requires. A chat that opens with "I've built a ramp-up model on EAFO data and want your view" gets more yeses than a cold interview request.

In the report, Tipping Point becomes the market use case, with the backtest chart and the eval numbers as evidence. It carries the same lesson as Cut-in: AI does the language work, code does the deciding, and a person confirms in between.

## Risks and open questions

The biggest risk is data volume. Six markets, eight years of history and about 40 inputs per market add up to more than 1,500 values with passports. If a gate slips, scope shrinks in a fixed order and the freeze date holds.

| Risk                                                                                  | What we do                                                                                            | If it bites                                                                              |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Data curation runs long                                                               | Annual figures only; EU defaults with country overrides; price indices instead of per-model histories | At G1, IT and BE ship as "beta" on priors, and the four other markets carry the backtest |
| The calibration can't tell its parameters apart                                       | Shared group means, one shift per market, priors, and the recovery test before real data              | Fewer free parameters, and the report says so                                            |
| Survey panel isn't the buyer population; intentions overshoot                         | Innovators from stock data; market shift fitted; limits stated on screen                              | The backtest shows the size of the error openly                                          |
| Company-car rules differ by country                                                   | Simplified rule per country, labelled, with a source each                                             | Company channel for DE and BE only; the others use the private logic with a flag         |
| Policy changes during the build (EU auto package vote in November, Plan Auto+ budget) | Every value is dated; the policy reader exists for exactly this                                       | Treated as a live demo                                                                   |
| Weekly Pro limit shared with Cut-in                                                   | Cut-in first on shared days; deep research only where direct fetches fail                             | At G2, Monte Carlo moves to v1.1; at G3, the stretch features drop                       |
| Workers or page tools blocked in the frame                                            | Spike in TP P1                                                                                        | Main-thread runs in chunks; the copilot uses a single JSON call instead of tools         |
| Mild hybrids hidden in the hybrid figures                                             | National splits where they exist; combined hybrid share scored in the backtest                        | A labelled assumption                                                                    |
| Confidentiality towards Deloitte                                                      | Public data and textbook methods only; no name in the app; pre-publish check                          | Check your employment contract's confidentiality clause before the link goes public      |

Open questions for TP P2:

- [ ] Horizon 2035, or 2040 to show the post-2035 effect of the softened target?
- [ ] Default holding period: six years private and four company, or one lifetime figure as in your old model?
- [ ] Should the app get Spanish as a third language after the freeze?
- [ ] Add Norway as a saturation check in v2?

## Sources

- [Deloitte: E-Mobility Sales Forecasting Model](https://www.deloitte.com/an/en/Industries/consumer-products/perspectives/e-mobility-sales-forecasting-model.html) (method reference only; not cited in the app)
- [EAFO Consumer Monitor downloads and the 2023 country list](https://alternative-fuels-observatory.ec.europa.eu/consumer-portal/consumer-monitor)
- [EAFO 2023 microdata on Zenodo, CC BY-SA 4.0](https://zenodo.org/records/14523769)
- [EAFO 2023 country report, the Netherlands](https://alternative-fuels-observatory.ec.europa.eu/system/files/documents/2024-06/Country%20Report%202023%20The%20Netherlands_1.pdf)
- [EAFO 2023 EU aggregated report](https://alternative-fuels-observatory.ec.europa.eu/system/files/documents/2024-06/2023%20EAFO%20Consumer%20Monitor%20-%20EU%20aggregated.pdf)
- [Consumer Monitor 2025, EU Publications Office](https://op.europa.eu/en/publication-detail/-/publication/3826dbdc-2ca6-11f1-906d-01aa75ed71a1)
- [DG MOVE: EU citizens show growing interest in electric vehicles](https://transport.ec.europa.eu/news-events/news/eu-citizens-show-growing-interest-electric-vehicles-survey-reveals-2026-03-26_en)
- [ACEA: new car registrations 2025](https://www.acea.auto/?p=54898)
- [electrive: German registrations 2025](https://www.electrive.net/2026/01/06/bilanz-2025-neuzulassungen-von-elektroautos-2025-auf-rekordhoch/)
- [electrive: German BEV share 2024 and 2023](https://www.electrive.net/2025/01/10/e-auto-bilanz-2024-grossbritannien-ueberholt-deutschland-bei-neuzulassungen/)
- [electrive: Germany opens applications for its new EV subsidy](https://www.electrive.com/2026/05/19/germany-opens-applications-for-new-ev-subsidy-scheme/)
- [Endesa: Plan Auto+ 2026 explained](https://www.endesa.com/en/electric-mobility/management-grants-auto-plus-plan)
- [electrive: EU transport committee postpones the auto package vote](https://www.electrive.net/2026/10/02/eu-verkehrsausschuss-vertragt-abstimmung-ueber-das-auto-paket/)
- [steuertipps: Kfz-Steuer exemption for BEVs extended](https://www.steuertipps.de/finanzamt-formalitaeten/elektroautos-kfz-steuerbefreiung-bis-ende-2035-verlaengert)
- [oEnergetíce: ETS2 price safeguard and 2028 start](https://oenergetice.cz/en/co2-emissions/ets-2-under-control-eu-approves-mechanism-to-keep-allowance-prices-in-check)
- [BNEF: battery pack prices fall to $108/kWh](https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour)

The AFIR charging ratios (1.3 kW per BEV, 0.8 kW per PHEV) and the BEHG corridor come from the regulations themselves; TP P6 links the official texts.
