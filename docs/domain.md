# Domain model (TP P3)

The vocabulary is in `CONTEXT.md`; this file says how the things relate, which rules always
hold, and which awkward cases the code must handle. Types live in `src/domain/types.ts`.

## The grid

Every model quantity is indexed by some of these dimensions:

| Dimension     | Values                                                              | Count |
| ------------- | ------------------------------------------------------------------- | ----- |
| Market        | DE, FR, ES, IT, NL, BE                                              | 6     |
| Year          | 2018 to 2040 (history to 2025, forecast 2026 on, outlook 2036 on)   | 23    |
| Vehicle class | small, medium, large, premium                                       | 4     |
| Buyer type    | private home charging, private no home charging, company            | 3     |
| Adopter group | innovators, early adopters, early majority, late majority, laggards | 5     |
| Powertrain    | ICE, FHEV, PHEV, BEV                                                | 4     |

Tactical registrations sit outside the grid: a share of each market's total, following the
market's average mix.

## Entities

- **Reference vehicle** (market-independent net price, class, powertrain): list price before
  VAT and registration tax, consumption, battery size, maintenance per km. Market-specific taxes
  and grants are rules applied to it, never baked in.
- **Cost input** (market, year, sometimes class, powertrain or buyer type): fuel and electricity
  prices, mileage, insurance rate, residual-value share, discount rate. Every value carries a
  passport.
- **Tax rule** (market, effective dates): VAT rate; registration tax and annual circulation tax
  as functions of price, CO2 and powertrain; company-car benefit in kind.
- **Programme** (market, effective dates): grant amount by powertrain, buyer type and income
  tier; price cap; extras (EU-assembly bonus, minimum dealer discount); budget end.
- **Class mapping** (source scheme): source segment → weights over vehicle classes, plus the
  premium override.
- **Group sizes** (market): five shares from the EAFO survey and stock data.
- **Parameters** (fitted): group thresholds, market shift, tolerance spread, novelty weights,
  appeal constants, taste spread, hurdle, adjustment speed. They carry a passport too: the fit
  run that produced them.
- **Lever** (catalogue entry): id, group, unit, scope (which dimensions it can target), limits.
- **Scenario**: a name, a description and a lever diff against the base case.
- **Forecast** (output): registrations by market, year, class, buyer type and powertrain;
  shares; TCO and ratios; stock; charging need; P10 and P90 where bands were run.

## Invariants

1. Shares of the four powertrains sum to 1 for every market, year, class, buyer type and group,
   within 1e-9.
2. Every share is in [0, 1]; every volume is non-negative and finite. NaN is an error.
3. Group sizes sum to 1 per market; class-mapping weights sum to 1 per source segment; buyer-type
   mix plus the tactical share sums to 1 per market and year.
4. Volumes summed over class, buyer type and powertrain equal the total market, within 0.5
   registrations.
5. Lowering one powertrain's TCO, with everything else fixed, never lowers its share.
6. Multiplying every cost of every powertrain by the same factor leaves every share unchanged
   (only ratios matter).
7. A class with no offer for a powertrain (small PHEV) gives that powertrain a share of exactly 0.
8. Stock is conserved: stock next year = stock + registrations − scrappage, per powertrain.
9. In history years (to 2025) the model reports observed registrations; fitted values are shown
   separately and never overwrite them.
10. Every input that reaches the model has a passport; every AI-touched value has a badge saying so.
11. Same inputs, same seed, same forecast, byte for byte.

## Edge cases the code handles

- A grant that starts or ends mid-year: the year's grant is the day-weighted average, and the
  backtest uses the actual dates (Germany's bonus ended on 17 Dec 2023, so 2023 keeps 96% of it).
- A list price exactly at a programme's price cap: eligible (caps are "up to"), tested both sides.
- Income-tiered grants: the private buyer types get the grant weighted by the share of
  households in each tier; company cars get the company rule.
- A holding period that runs past 2040: costs beyond the horizon use the last year's values.
- The 2035 Kfz-Steuer cliff: a BEV registered in 2030 is exempt until 31 Dec 2035, then pays.
- A PHEV whose electric range is below a programme's minimum (Plan Auto+: 40 km): not eligible.
- A market where a powertrain had near-zero share in early history (FHEV in NL 2018): the fit
  doesn't divide by it; errors are measured in percentage points, not relative terms.
- A scenario lever outside its limits: rejected with the limit named, never clipped silently.
- An imported forecast file whose total differs from ACEA 2025 by more than 2%: flagged, and
  the user decides which wins.
- A source segment the mapper can't place (Wohnmobile): marked out of scope and excluded from
  the reconciliation, with its volume shown.
