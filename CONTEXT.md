# Tipping Point

Forecasting how new-car buyers in six European markets split across powertrains, from what each
powertrain costs to own and how willing each group of buyers is to switch. German terms in
brackets are what a German planning team would say.

## Markets and the cars

**Market**:
One national new-car market: DE, FR, ES, IT, NL or BE.
_Avoid_: country (except in prose), region

**Registrations** (Neuzulassungen):
New cars registered in a market in a calendar year; the quantity the model forecasts.
_Avoid_: sales, deliveries (they differ by timing and channel)

**Total market** (Gesamtmarkt):
All new-car registrations in a market and year, before the powertrain split.

**Powertrain** (Antriebsart):
One of ICE, FHEV, PHEV, BEV. Range extenders count as PHEV; mild hybrids count as ICE.
_Avoid_: drivetrain, fuel type, technology

**Full hybrid** (FHEV, Vollhybrid):
A hybrid that drives short distances on electric power and can't be plugged in.
_Avoid_: HEV (in ACEA data it also includes mild hybrids), self-charging hybrid

**Vehicle class** (Fahrzeugklasse):
One of small, medium, large (SUV) and premium; the size and price band a buyer shops in.
_Avoid_: segment (that word belongs to the source schemes)

**Source segment**:
A category in someone else's scheme (a KBA segment, a European A to F segment, a client's own class) that the class mapping turns into vehicle classes.

**Class mapping**:
Weights that split each source segment into vehicle classes, with the premium override applied after.

**Premium override**:
The rule that moves a car to the premium class when its brand is on the premium list or its list price is at least €60,000.

**Reference vehicle**:
The representative car for one class and powertrain, built from the average of two or three real models.
_Avoid_: model, average car

## Buyers

**Buyer type** (Käufertyp):
Private with home charging, private without home charging, or company car.
_Avoid_: customer segment (that word is taken by the adopter groups in other models)

**Tactical registrations** (taktische Zulassungen):
Dealer self-registrations and rental fleets; they follow the market's average mix and have no TCO.
_Avoid_: fleet (company cars are fleet too)

**Adopter group** (Käufergruppe):
One of innovators, early adopters, early majority, late majority and laggards; buyers who share one switching tolerance distribution.
_Avoid_: segment, persona, cluster

**Group size**:
The share of a market's buyers in one adopter group, from EAFO survey answers and stock data.

**Tolerance** (Wechselbereitschaft):
How much more, as a TCO ratio, a buyer accepts to pay for the newest powertrain; normally distributed within a group.
_Avoid_: threshold (the mean of a group's tolerance is its threshold), willingness to pay

**Novelty weight**:
How strongly a powertrain draws on a buyer's tolerance: 1 for BEV, 0 for ICE, in between for PHEV and FHEV.

**Hurdle**:
A non-cost barrier that makes a powertrain feel dearer than it is, such as having no home charger.

**Appeal constant**:
A calibrated preference for or against a powertrain that cost and tolerance don't explain, such as how few full-hybrid models a brand offers.

## Cost

**TCO** (Gesamtkosten, Total Cost of Ownership):
The present value of owning a reference vehicle over the holding period: price after grants plus running costs minus residual value.

**TCO ratio** (Kostenverhältnis):
A powertrain's TCO divided by the ICE TCO for the same market, year, class and buyer type. 1 is parity; 1.2 means 20% more.

**Effective ratio**:
The TCO ratio after the hurdle; what the buyer acts on.

**Parity year**:
The first year a powertrain's TCO ratio is at or below 1 for a given market, class and buyer type.

**Holding period** (Haltedauer):
Years the first owner keeps the car: six private, four company by default.

**Residual value** (Restwert):
What the car is worth at the end of the holding period, as a share of its list price.

**Grant** (Förderung, Prämie):
Money a programme pays toward a purchase or lease, with its own eligibility rules and dates.
_Avoid_: incentive (too broad: it also covers tax breaks), subsidy

**Programme** (Förderprogramm):
A dated set of grant rules, such as Germany's 2026 bonus or Spain's Plan Auto+.

**Benefit in kind** (geldwerter Vorteil):
The tax a company-car driver pays on private use; the 0.25% rule in Germany is one.

**Utility factor**:
The share of a PHEV's kilometres driven on electricity in real use, by buyer type.

**Passport** (Herkunft):
The record behind every input value: unit, source, link, retrieval date, confidence, low and high.

## Forecast

**Lever** (Stellhebel):
An input a scenario may change: a price path, an energy price, a tax, a grant, a behaviour parameter.

**Lever diff**:
The list of lever changes a scenario makes against the base, shown as a receipt before it runs.

**Scenario** (Szenario):
A named lever diff against the base case.

**Base case** (Basisszenario):
The forecast with every lever at its sourced default.

**Equilibrium share**:
The powertrain shares the choice rule gives for one year's costs, before the market's lag.

**Adjustment speed**:
How much of the gap to the equilibrium share a market closes in one year.

**Stock** (Bestand):
Cars on the road by powertrain, carried forward from registrations minus scrappage.

**Charging need**:
The public charging power AFIR requires for the stock: 1.3 kW per BEV and 0.8 kW per PHEV.

**Backtest origin**:
The last year of data a backtest fit may see; the forecast years after it are scored.

**Outlook years**:
2036 to 2040: forecast, drawn lighter, outside headline numbers and goal seek.

## AI

**Draft**:
Anything Claude produces before a person confirms it; a draft never changes a number.

**Confirmed**:
A draft a person accepted, field by field where the feature asks for it.

**Source passage**:
The exact words in a pasted text that a policy-reader field came from.

**Number guard**:
The check that every number in AI-written text exists in the data or model output it was given.

**Trace** ("show the work"):
The record of one AI answer: the prompt, each tool call, what each returned and the final text.
