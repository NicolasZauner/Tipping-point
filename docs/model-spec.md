# Model spec (TP P3)

What `src/model` computes, formula by formula. Code follows this file; when they disagree, the
code is wrong until this file is changed on purpose. Terms are defined in `CONTEXT.md`.

Indices: market m, year y, vehicle class v, buyer type b, adopter group g, powertrain k ∈
{ICE, FHEV, PHEV, BEV}. Money is real 2025 euros; nominal sources are deflated with Eurostat
HICP before they enter.

## 1. Total cost of ownership

For one reference vehicle (m, y, v, k) bought by buyer type b in year y and kept T years
(T = 6 private, 4 company; or the lifetime toggle: 10 years, no residual value):

```latex
\mathrm{TCO} = P - G + \sum_{t=1}^{T} \frac{E_t + M_t + I_t + X_t}{(1+r)^t} - \frac{RV_T}{(1+r)^T}
```

| Term | Definition                                                                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P    | Net list price × (1 + VAT) + registration tax − typical dealer discount. Company buyers use the price without VAT (they reclaim it).                                                                                                                 |
| G    | Sum of grants the buyer is eligible for in year y. A programme active for only part of the year counts with its day-weighted share. Income-tiered grants are weighted by the share of households in each tier. A price exactly at a cap is eligible. |
| E_t  | Energy per year (below).                                                                                                                                                                                                                             |
| M_t  | km × maintenance-and-tyres rate (€/km) for k, scaled by the market's price level.                                                                                                                                                                    |
| I_t  | Insurance rate × list price.                                                                                                                                                                                                                         |
| X_t  | Annual circulation tax for that year of ownership (so the 2035 Kfz-Steuer end is hit in the right year) + CO2 levy on fuel, already inside the fuel price path, never added twice.                                                                   |
| RV_T | List price (gross for private, net for company) × residual share after T years.                                                                                                                                                                      |
| r    | Real discount rate: 5% private, 6% company.                                                                                                                                                                                                          |

Prices for t beyond 2040 hold at their 2040 value.

### Energy

- ICE and FHEV: km × L/100 km (real-world) × fuel price.
- BEV: km × kWh/100 km (real-world) × (1 + charging loss) × charging price mix for b:
  home with charger 85% home / 10% public AC / 5% DC; no home charger 0% / 60% / 40%;
  company 50% home or work / 30% / 20%. Mixes are passport values.
- PHEV: km × [UF_b × kWh/100 km × (1 + loss) × home price + (1 − UF_b) × L/100 km in charge
  sustaining × fuel price]. The real-world utility factor UF_b differs sharply by buyer type
  (company cars charge least).

Real-world uplift on type-approval values is one passport value per powertrain.

### Company cars

```latex
\mathrm{TCO}_{\mathrm{company}} = \mathrm{TCO}_{\mathrm{employer}} + w \cdot \sum_{t=1}^{T} \frac{\mathrm{BIK}_t \cdot \tau_{\mathrm{inc}}}{(1+r)^t}
```

The employer TCO uses net prices, reclaims VAT and applies the market's deductibility rule (for
Belgium the CO2-dependent deductibility, for the others full deductibility). BIK_t is the
taxable benefit in kind from the market's simplified rule (DE 1% / 0.5% / 0.25% of list price
per month, NL bijtelling, FR avantage en nature, ES and IT flat rates); τ_inc is a marginal
income tax rate per market; w (default 1) weights the driver's view against the employer's.

## 2. Ratio and effective ratio

```latex
R_k = \frac{\mathrm{TCO}_k}{\mathrm{TCO}_{\mathrm{ICE}}}, \qquad e_k = R_k \,(1 + h_{k,b})
```

The hurdle h is 0 for ICE and FHEV. For BEV it is the no-home-charger hurdle for the private
buyer without a home charger, 0 otherwise. A powertrain not offered in a class (small PHEV)
leaves the choice set.

## 3. The choice rule

A buyer in group g has tolerance t ~ Normal(μ_g + γ_m, σ). Each offered powertrain scores

```latex
u_k(t) = a_k\,(t - 1) - (e_k - 1) + c_k, \qquad u_{\mathrm{ICE}} = 0
```

with novelty weights a (BEV 1, ICE 0, PHEV and FHEV fitted in between) and appeal constants c
(fitted, 0 for ICE). Choice probabilities:

```latex
P_k(t) = \frac{\exp(u_k(t)/\tau)}{\sum_j \exp(u_j(t)/\tau)}, \qquad S_{k,g} = \mathbb{E}_t\left[P_k(t)\right]
```

- **τ → 0 is the crisp rule:** each buyer takes the best score, ties going to the more
  conservative powertrain (ICE, FHEV, PHEV, BEV). With only BEV offered and c = 0 it is exactly
  your consulting logic: S_BEV = Φ((μ_g + γ_m − e_BEV) / σ).
- **Why τ > 0 in production:** the prototype (`prototypes/choice-rule.prototype.html` on branch `prototype/choice-rule`, case 5)
  shows the crisp rule with three alternatives jumps from 0% to 89% PHEV on one 15% price step,
  because the middle alternative wins nobody or everybody. A taste spread τ smooths that into the
  partial shifts registrations show. It is fitted, with a prior around 0.03.
- **Why c:** on priors alone a German private buyer with a home charger gets over 40% BEV in
  2026, far above reality (case 3). Model ranges, charging worries and habits sit outside the
  TCO; the appeal constants are where calibration puts them.

Computation, no random draws:

- τ = 0: scores are straight lines in t, so each powertrain wins on intervals of t found from
  the upper envelope of the lines. The share is the normal probability of those intervals,
  exact (no integration error; the prototype's 201-point sum is off by up to 0.25 points).
- τ > 0: Gauss–Hermite quadrature with 48 nodes per group, which TP P9 tests against 20,000-point midpoint sums to better than 1e-6.

Group thresholds are kept in order (innovators > early adopters > … > laggards) by fitting the
laggard threshold plus four positive gaps.

## 4. Equilibrium shares to registrations

Equilibrium shares per cell (m, y, v, b):

```latex
S^{*}_{k} = \sum_g n_{m,g}\, S_{k,g}
```

with EAFO group sizes n. The market moves toward them with adjustment speed λ ∈ (0, 1]:

```latex
S_{y} = S_{y-1} + \lambda\,(S^{*}_{y} - S_{y-1})
```

This keeps every share in [0, 1] and every cell summing to 1. The 2025 starting shares per cell
are the fitted 2025 cell shares raked (iterative proportional fitting) so that, summed over
cells, they match the observed 2025 powertrain split exactly.

Registrations:

```latex
V_{m,y} = V_{m,2025}\,(1+g_m)^{y-2025}, \qquad V_{m,y,v,b,k} = V_{m,y}\,(1 - q_m)\,\omega_{m,v}\,\beta_{m,b}\,S_{m,y,v,b,k}
```

with CAGR g, tactical share q (following the market's average mix), class mix ω and buyer-type
mix β. An imported forecast file replaces V_{m,y}.

## 5. Stock and charging need

Stock by powertrain is a cohort model from 2018 registrations onward, with Weibull survival per
market. Cars registered before 2018 form one cohort, retired at the market's average scrappage
rate. The fleet-based AFIR target is

```latex
\text{public kW}_{m,y} = 1.3 \cdot \mathrm{Stock}_{\mathrm{BEV}} + 0.8 \cdot \mathrm{Stock}_{\mathrm{PHEV}}
```

compared with installed public power from EAFO.

### Fleet CO2 (added 21 Oct 2026)

Average tailpipe CO2 of new cars per market and year, from the forecast volumes:

```latex
\overline{\mathrm{CO_2}}_{m,y} = \frac{\sum_{c,k} V_{m,y,c,k}\, g_{c,k}}{\sum_{c,k} V_{m,y,c,k}}
```

with g_{c,k} the WLTP g/km of the reference vehicle of class c and powertrain k (BEV 0; PHEV
its type-approval value, not real-world, because the targets use type approval). Drawn against
the EU fleet targets: 93.6 g/km for 2025 to 2029 (the 2025 to 2027 average allowed), 49.5 g/km
for 2030 to 2034, 0 from 2035 under current law; scenario S5 uses the proposed 90% cut. The
targets bind each manufacturer's EU fleet, so the screen calls this a market indicator, not a
compliance check. Tactical registrations count with the market's average mix.

## 6. Calibration

Parameters θ and their priors (mean, standard deviation):

| Parameter                              | Prior                | Note                                                                                |
| -------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Laggard threshold                      | 0.80 (0.08)          | Gaps to the next groups: 0.13, 0.09, 0.13, 0.20 (each 0.05, positive)               |
| Market shift γ_m                       | 0 (0.10)             | One per market                                                                      |
| Tolerance spread σ                     | 0.08 (0.03)          | Positive                                                                            |
| Novelty weights a_PHEV, a_FHEV         | 0.6 (0.2), 0.2 (0.1) | In [0, 1]                                                                           |
| Appeal constants c_BEV, c_PHEV, c_FHEV | 0 (0.10) each        | Shared across markets; a per-market FHEV constant only if the backtest shows a bias |
| Taste spread τ                         | 0.03 (0.02)          | Positive                                                                            |
| No-home-charger hurdle                 | 0.08 (0.05)          | Non-negative                                                                        |
| Adjustment speed λ                     | 0.6 (0.2)            | In (0, 1]                                                                           |

That's 20 parameters against 144 observations (6 markets × 8 years × 3 shares). The objective
is penalised least squares:

```latex
\min_\theta \sum_{m,y,k} \left(\frac{S^{\mathrm{obs}}_{m,y,k} - S^{\mathrm{fit}}_{m,y,k}(\theta)}{s_{\mathrm{obs}}}\right)^2 + \sum_i \left(\frac{\theta_i - \theta_i^0}{s_i}\right)^2
```

over k ∈ {BEV, PHEV, hybrid}, with an observation noise s_obs of one percentage point. Observed "hybrid" (ACEA HEV) includes mild hybrids, so the
fitted hybrid share is FHEV + the labelled mild-hybrid share of ICE for that market and year.
Bounded parameters are fitted on transformed scales (log for positive, logit for (0, 1]).
Nelder–Mead from 8 seeded starts; the best run wins, ties to the lower seed.

Recovery test before real data: simulate shares from known θ plus noise of 0.5 points, fit, and
require every parameter back within two prior standard deviations and the fitted shares within
0.5 points.

## 7. Backtest

Rolling origins 2021, 2022, 2023: fit on years up to the origin, forecast origin + 1 and + 2
with the inputs that actually happened. Score: mean absolute error in percentage points of
share, per powertrain and overall, against two naive baselines (last observed share; linear
trend over the last three years). The headline is origin 2023 for Germany (2024 dip, 2025
rebound).

## 8. Uncertainty, goal seek, attribution

- **Monte Carlo:** each uncertain input draws from a triangular distribution (low, likely,
  high) from its passport. 500 Latin-hypercube draws; fuel and electricity prices rank-correlated
  at 0.5 (Iman–Conover); seeded. Output P10, P50, P90 per share and volume.
- **Goal seek:** bisection on one lever between its limits until the target share or stock in
  the target year is met within 0.05 points, at most 60 steps. It first checks the target lies
  between the results at both limits and otherwise reports "not reachable within limits" with
  both end values. The lever must move the result in one direction only; the check runs 11
  evenly spaced points and refuses levers that don't.
- **Attribution:** levers fall into six groups (vehicle prices, grants, taxes, energy prices,
  residual values, behaviour). The Shapley value of group i between scenario A and B is the
  average, over all orders, of the change when i switches from A to B; with six groups that is
  64 runs, exact. The six values sum to the total difference (tested).

## 9. Worked example (illustrative inputs, not curated data)

Germany 2026, medium class, private buyer with home charger, eligible for a €3,000 BEV bonus,
13,000 km a year, six years, 5% real.

| Input                     | ICE       | FHEV      | PHEV                          | BEV               |
| ------------------------- | --------- | --------- | ----------------------------- | ----------------- |
| Price incl. VAT           | €33,000   | €34,500   | €41,000                       | €38,000           |
| Grant                     | 0         | 0         | 0                             | €3,000            |
| Real-world consumption    | 6.0 L     | 4.6 L     | 20 kWh at UF 0.45, else 6.5 L | 17 kWh + 10% loss |
| Energy price              | €1.75/L   | €1.75/L   | both                          | €0.36/kWh at home |
| Energy per year           | €1,365    | €1,046    | €1,277                        | €875              |
| Maintenance               | €0.045/km | €0.042/km | €0.043/km                     | €0.030/km         |
| Insurance per year        | €700      | €720      | €760                          | €750              |
| Kfz-Steuer per year       | €100      | €60       | €40                           | €0                |
| Residual share at 6 years | 40%       | 42%       | 37%                           | 35%               |

| Present value     | ICE        | FHEV       | PHEV       | BEV        |
| ----------------- | ---------- | ---------- | ---------- | ---------- |
| Price after grant | 33,000     | 34,500     | 41,000     | 35,000     |
| Energy            | 6,928      | 5,312      | 6,480      | 4,442      |
| Maintenance       | 2,969      | 2,771      | 2,837      | 1,980      |
| Insurance         | 3,553      | 3,654      | 3,858      | 3,807      |
| Tax               | 508        | 305        | 203        | 0          |
| Residual value    | −9,850     | −10,813    | −11,320    | −9,925     |
| **TCO**           | **37,108** | **35,729** | **43,058** | **35,304** |
| **Ratio to ICE**  | 1          | 0.963      | 1.160      | 0.951      |

With the prior thresholds and the Dutch group sizes (5, 23.8, 7.6, 36.1, 27.6%):

| Rule                                                      | ICE   | FHEV  | PHEV | BEV   |
| --------------------------------------------------------- | ----- | ----- | ---- | ----- |
| Crisp (τ = 0, c = 0), 201-point sum                       | 18.5% | 39.1% | 0.0% | 42.5% |
| With τ = 0.03 and guessed constants (−0.06, −0.02, −0.08) | 54.3% | 13.0% | 0.1% | 32.8% |

The crisp row comes from the prototype's 201-point sum; the exact envelope method may differ by a few tenths of a point. Both rows overshoot Germany's actual BEV share among private buyers, which is the point: priors
are a starting place and calibration does the rest. The numbers are reproducible with
the prototype and the TP P8 tests will rebuild this table to the euro.
