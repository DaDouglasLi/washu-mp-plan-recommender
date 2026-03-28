# WashU Meal Plan Optimizer

A local-first MVP web app that helps Washington University in St. Louis students choose a meal plan for their **next semester** by combining historical meal-point spending with class-schedule patterns.

## Project overview

This app is intentionally designed around one core objective:

> **Minimize expected total cost while keeping daily dining practical.**

The optimizer is **not** trying to maximize meal-point usage, and it is **not** trying to force a plan that covers 100% of predicted spending.  
In many cases, a lower plan plus modest out-of-pocket spending (Bear Bucks or card) is cheaper than buying a higher plan with expensive unused points.

## Problem statement

Students often choose meal plans with limited visibility into:

- how their class schedule changes dining behavior,
- how much of spending is stable vs elastic (lunch/snacks/dinner),
- how rollover/forfeiture rules affect total cost.

This app estimates category-level next-semester spend and then recommends the lowest-cost practical plan under WashU policy constraints.

## Why "cover all spending" is not always optimal

If predicted spending is slightly above a lower plan, it can be better to:

- choose the lower plan,
- pay a small shortfall out of pocket,
- avoid paying for a much larger plan premium.

The recommender explicitly scores this trade-off and penalizes unnecessary overbuying, especially in spring when leftover points are forfeited.

## Hard-coded WashU meal plan policies

### Plan values (Fall 2026 / Spring 2027)

- Platinum: 3557 points, $4561
- Gold: 3184 points, $4188
- Silver: 2604 points, $3608
- Bronze: 2012 points, $3016
- Apartment: 922 points, $1358
- Off-Campus: 544 points, $844

### Historical semester boundaries used by the model

The model uses reusable rough semester windows instead of a single fixed academic year:

- Fall: approximately `Aug 20` to `Dec 20`
- Spring: approximately `Jan 10` to `May 10`

The year is chosen automatically from the current date so the same transaction-filtering logic can keep working across future years.

### Policy logic encoded

- Meal points are declining-balance.
- Unused fall points roll over to spring.
- Students must still purchase a spring meal plan.
- Unused points after spring are forfeited.
- First-year students: minimum eligible plan is Silver.
- Non-first-year students living on campus: minimum is Bronze.
- Students living off campus can use lower plans including Off-Campus.
- "Suggested Balance" is intentionally ignored.

## Semester-specific prediction logic

### Finding the meal transaction record

Students can download the required meal points transaction record from the [WashU Campus Card Portal](https://atrium.wustl.edu/). In `Account Management`, open `Account Statements`, choose `Mealpoints` under accounts, and select `Last 9 Month` for the period.

### Predicting Spring

Required inputs:

- meal transaction history CSV
- previous fall on-campus time when living off campus
- future spring on-campus time when living off campus

Model behavior:

- uses the previous fall transaction window only, plus manual campus-time shift, to estimate spring demand,
- estimates rollover from fall into spring,
- optional user inputs improve rollover accuracy:
  - known fall plan,
  - known current remaining balance.

### Predicting Fall

Required inputs:

- meal transaction history CSV
- previous fall on-campus time when living off campus
- previous spring on-campus time when living off campus
- future fall on-campus time when living off campus

Model behavior:

- uses the previous fall and current spring transaction windows together as the historical baseline,
- compares historical fall/spring campus-time patterns against manually entered future fall time,
- marks fall forecasts as higher uncertainty than spring.

## End-to-end analysis pipeline

Logical chain:

**historical transactions -> behavior categories -> campus-time inference -> next-semester demand estimation -> policy-aware recommendation -> cheapest practical plan**

### 1) Meal parsing and normalization

- tolerant header matching (`date`, `time`/`datetime`, `amount`/`points`, `merchant`/`description`)
- invalid-row filtering (bad dates, non-positive values, extreme amounts)
- weekday/hour extraction
- on-campus confidence tagging from merchant/location text heuristics

### 2) Manual on-campus time input

- users enter day/time blocks directly in the browser
- supports multiple time ranges per day
- validates that each time block is complete and start time is before end time
- derives features:
  - lunch presence days,
  - dinner presence days,
  - evening presence,
  - average total campus time,
  - average longest daytime gap

### 3) Behavior categorization

Rule-based windows:

- breakfast-ish: before 11:00
- lunch-ish: 11:00 to 14:30
- snack-ish: 14:30 to 17:30
- dinner-ish: 17:30 to 21:30
- late: after 21:30

Amount bands are used as secondary heuristics for snack vs meal distinctions.

### 4) Feature engineering

Extracted features include:

- average weekly spend and transactions,
- lunch/dinner/snack transactions per week,
- average spend per category transaction,
- weekday vs weekend spend ratio,
- lunch and dinner probability conditioned on campus presence,
- snack tendency during long campus gaps,
- weekly volatility and trend.

### 5) Local behavioral modeling

- deterministic feature-based estimation (no cloud AI, no training pipeline)
- schedule-shift multipliers adjust lunch/snack/dinner demand by context change
- optional profile labels for explainability:
  - Lunch-Driven
  - Frequent Afternoon Snacker
  - Evening-On-Campus Diner
  - Low-Variance Light User
  - High-Variance Flexible User

### 6) Recommendation engine

For each eligible plan:

- computes available points (including spring rollover when applicable),
- computes expected shortfall,
- computes expected waste,
- computes expected total cost = plan cost + expected shortfall,
- adds practicality penalty when shortfall becomes too large,
- adds waste/forfeiture penalty (stronger in spring).

Outputs:

- recommended plan (best score),
- cheapest practical option,
- more conservative option,
- human-readable rationale and uncertainty notes.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- `papaparse` for CSV parsing
- `recharts` for lightweight client-side charts

All logic executes client-side in the browser.

## Project structure

```text
app/
  layout.tsx
  page.tsx
components/
  FileUploadField.tsx
  OnCampusTimeSection.tsx
  ResultsDashboard.tsx
  SectionCard.tsx
lib/
  analysis/
    features.ts
    pipeline.ts
    predictor.ts
    spending-classifier.ts
  meal-rules/
    constants.ts
  parsing/
    meal-history.ts
    tabular.ts
  on-campus-time.ts
  recommendation/
    engine.ts
types/
  domain.ts
public/fixtures/
  sample CSV files for quick testing
```

## Local development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Vercel deployment

This app is already deployed through Vercel at:

[https://washu-mp-plan-recommender-p4cax8s75-dadouglaslis-projects.vercel.app/](https://washu-mp-plan-recommender-p4cax8s75-dadouglaslis-projects.vercel.app/)

## Privacy model

- no login/auth
- no backend database
- no server-side storage
- no analytics tracking
- uploads processed only in browser memory
- refreshing page clears loaded data

## Assumptions and limitations

- Heuristic categorization is intentionally transparent, not perfect.
- Merchant-based campus detection may misclassify ambiguous rows.
- Fall prediction has structurally higher uncertainty than spring.
- Forecast is practical guidance, not a guarantee.
- Current implementation assumes one primary transaction-history file and schedule exports with parseable structure.

## Future improvements

- richer schedule format adapters (additional registrar export variants),
- optional confidence intervals on plan shortfall/waste,
- richer campus-location dictionary for transaction confidence,
- advanced but still local explainability diagnostics,
- optional what-if controls for behavior changes (fewer snacks, more dinners, etc.).
