export type PredictionSemester = "fall" | "spring";
export type ClassYear =
  | "first-year"
  | "sophomore"
  | "junior"
  | "senior"
  | "graduate"
  | "other-upper-class";

export type MealPlanId =
  | "platinum"
  | "gold"
  | "silver"
  | "bronze"
  | "apartment"
  | "off-campus";

export interface MealPlan {
  id: MealPlanId;
  name: string;
  points: number;
  costUsd: number;
}

export interface UploadedFileState {
  name: string;
  rows: number;
}

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface OnCampusTimeBlock {
  id: string;
  day: DayOfWeek;
  start: string;
  end: string;
}

export interface ParsedMealTransaction {
  id: string;
  date: Date;
  weekday: number;
  hour: number;
  amount: number;
  merchant: string;
  rawDescription: string;
  onCampusConfidence: "high" | "medium" | "low";
}

export interface ScheduleFeatures {
  lunchPresenceDays: number;
  dinnerPresenceDays: number;
  avgLongestGapMinutes: number;
  avgTotalCampusMinutes: number;
  eveningPresenceDays: number;
}

export type SpendCategory =
  | "breakfast"
  | "lunch"
  | "snack"
  | "dinner"
  | "late"
  | "misc";

export interface CategorizedTransaction extends ParsedMealTransaction {
  category: SpendCategory;
}

export interface WeeklySpendFeatureSet {
  avgWeeklySpend: number;
  avgWeeklyTransactions: number;
  weeklySpendSeries: number[];
  weeklyTxnCountSeries: number[];
  lunchTransactionsPerWeek: number;
  dinnerTransactionsPerWeek: number;
  snackTransactionsPerWeek: number;
  avgSpendPerLunch: number;
  avgSpendPerDinner: number;
  avgSpendPerSnack: number;
  weekdaySpendRatio: number;
  lunchWhenOnCampusProb: number;
  dinnerWhenOnCampusProb: number;
  snackDuringLongGapProb: number;
  behaviorProbabilities: {
    lunchGivenLunchPresence: number;
    dinnerGivenEveningPresence: number;
    snackGivenLongGap: number;
  };
  weeklySpendVolatility: number;
  trendPerWeek: number;
}

export interface CategoryDemandEstimate {
  lunch: number;
  snack: number;
  dinner: number;
  miscellaneous: number;
}

export interface PredictionOutput {
  profileLabel: string;
  predictedTotalSpend: number;
  categoryBreakdown: CategoryDemandEstimate;
  budgetSignals: {
    depletionScore: number;
    burnDownScore: number;
  };
  uncertaintyScore: number;
  notes: string[];
}

export interface PlanScore {
  plan: MealPlan;
  availablePoints: number;
  expectedShortfall: number;
  expectedWaste: number;
  expectedTotalCost: number;
  practicalityPenalty: number;
  totalScore: number;
  rationale: string[];
}

export interface RecommendationOutput {
  recommended: PlanScore;
  cheapestPractical: PlanScore;
  conservative: PlanScore;
  allEligible: PlanScore[];
  reasoning: string[];
}
