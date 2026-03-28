# WashU Meal Plan Optimizer

A local-first MVP web app that helps Washington University in St. Louis students choose a meal plan for their **next semester** by combining historical meal-point spending with manually entered on-campus time patterns.

The core prediction and recommendation logic remains deterministic and local. OpenAI is used only after the local analysis finishes to generate a clearer, more nuanced explanation of the computed result.

## Prompt fit

This project is meant to answer the prompt directly: **build an AI-powered tool I personally wish existed**.

### 1) Specific user scenario and problem

The user is a WashU student trying to choose the cheapest practical meal plan for the next semester. This is a real decision with confusing tradeoffs:

- spending changes when class cadence and campus time change
- leftover and rollover rules make "cover everything" a bad heuristic
- students often do not know whether a lower plan plus small out-of-pocket spending is smarter than buying a larger plan

This tool exists to turn that unclear decision into a practical recommendation grounded in the student's own transaction history.

### 2) Non-trivial AI component

The app includes a real AI layer, but it is intentionally used in a controlled way.

- the local model first computes the prediction and recommendation deterministically
- the app then sends a structured summary of the computed result to OpenAI
- OpenAI generates a more detailed advisor-style explanation of:
  - why the recommended plan won
  - what cheaper or safer alternatives also make sense
  - what uncertainty or caveats matter

This is a non-trivial AI component because it uses structured prompting, a server-side explanation route, constrained grounding on computed results, and fallback behavior when the API is unavailable.

### 3) Clear system design and AI integration

The system has two layers:

- **Local analysis layer:** parses the meal CSV, derives behavioral features, applies budget-pressure logic, compares campus-time patterns, predicts next-semester spend, and scores meal plans.
- **AI explanation layer:** takes only the summarized analysis output and generates a clearer human explanation.

The AI does **not** choose the plan and does **not** process raw uploaded files. The recommendation itself is still produced by the local model logic.

## Project overview

This app is intentionally designed around one core objective:

> **Minimize expected total cost while keeping daily dining practical.**

The optimizer is **not** trying to maximize meal-point usage, and it is **not** trying to force a plan that covers 100% of predicted spending.  
In many cases, a lower plan plus modest out-of-pocket spending (Bear Bucks or card) is cheaper than buying a higher plan with expensive unused points.

## AI + model roles

The project has two clearly separated layers:

- **Local model logic:** parses the transaction CSV, derives behavioral features, compares campus-time patterns, predicts next-semester spend, and scores meal plans.
- **AI explanation layer:** takes the already-computed structured result and turns it into a clearer explanation of why the recommendation was chosen, what tradeoffs exist, and which alternatives also make sense.

OpenAI does **not** decide the plan. The app decides the plan locally first, then asks OpenAI to explain it.

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

### Semester ranges

- Fall 2026: Aug 14, 2026 to Dec 17, 2026
- Spring 2027: Jan 15, 2027 to May 13, 2027

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

- uses fall behavior + manual campus-time shift to estimate spring demand,
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
- lightweight budget-pressure logic detects possible depletion or burn-down behavior late in the semester
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

### 7) AI-generated explanation

- runs only after the local analysis is complete
- receives only summarized analysis results, never raw uploaded files
- explains why the recommended plan won, what the cheaper and safer alternatives are, and where uncertainty remains
- falls back to a local summary if the OpenAI API is unavailable

Outputs:

- recommended plan (best score),
- cheapest practical option,
- more conservative option,
- human-readable rationale and uncertainty notes.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- `papaparse` for CSV parsing
- OpenAI JavaScript SDK for server-side explanation generation
- `recharts` for lightweight client-side charts

Core analysis executes locally in the browser. The optional explanation layer runs on the server and sends only summarized analysis results to OpenAI.

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

## Run locally

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create and fill `.env` before using AI explanations:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
```

If you leave `OPENAI_API_KEY` empty or invalid, the app will still run and will fall back to a local explanation summary.

### 3) Start the app

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### 4) Build locally

```bash
npm run build
```

## Privacy model

- no login/auth
- no backend database
- no server-side storage of uploaded files
- no analytics tracking
- uploads processed only in browser memory
- refreshing page clears loaded data
- raw uploaded files stay local
- only summarized analysis results are sent to OpenAI for explanation generation
- if the OpenAI API is unavailable, the app falls back to a local explanation summary

## Assumptions and limitations

- Heuristic categorization is intentionally transparent, not perfect.
- Merchant-based campus detection may misclassify ambiguous rows.
- Fall prediction has structurally higher uncertainty than spring.
- Forecast is practical guidance, not a guarantee.
- Current implementation assumes one primary transaction-history CSV and manually entered on-campus time.

## Future improvements

- richer schedule format adapters (additional registrar export variants),
- optional confidence intervals on plan shortfall/waste,
- richer campus-location dictionary for transaction confidence,
- advanced but still local explainability diagnostics,
- optional what-if controls for behavior changes (fewer snacks, more dinners, etc.).
