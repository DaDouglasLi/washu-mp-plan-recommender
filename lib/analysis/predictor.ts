import { TERM_WEEKS } from "@/lib/meal-rules/constants";
import {
  CategoryDemandEstimate,
  PredictionOutput,
  PredictionSemester,
  ScheduleFeatures,
  WeeklySpendFeatureSet,
} from "@/types/domain";
import { applyBudgetPressureAdjustment } from "./budget-adjustment";
import { profileLabelFromFeatures } from "./features";

function scheduleShiftMultiplier(
  fromSchedule: ScheduleFeatures,
  toSchedule: ScheduleFeatures,
): { lunch: number; snack: number; dinner: number } {
  const lunchRatio =
    (toSchedule.lunchPresenceDays + 1) / Math.max(1, fromSchedule.lunchPresenceDays + 1);
  const dinnerRatio =
    (toSchedule.dinnerPresenceDays + 1) / Math.max(1, fromSchedule.dinnerPresenceDays + 1);
  const gapRatio =
    (toSchedule.avgLongestGapMinutes + 30) /
    Math.max(30, fromSchedule.avgLongestGapMinutes + 30);

  return {
    lunch: Math.max(0.7, Math.min(1.4, lunchRatio)),
    dinner: Math.max(0.7, Math.min(1.5, dinnerRatio)),
    snack: Math.max(0.7, Math.min(1.6, gapRatio)),
  };
}

function probabilityRefinementFactor(probability: number): number {
  // Keep refinement lightweight: probabilities nudge category demand by +/- ~8%.
  return 0.92 + Math.max(0, Math.min(1, probability)) * 0.16;
}

export interface PredictorInput {
  mode: PredictionSemester;
  historicalFeatures: WeeklySpendFeatureSet;
  baselineSchedule: ScheduleFeatures;
  targetSchedule: ScheduleFeatures;
}

export function predictNextSemesterDemand(input: PredictorInput): PredictionOutput {
  const {
    mode,
    historicalFeatures,
    baselineSchedule,
    targetSchedule,
  } = input;

  const shifts = scheduleShiftMultiplier(baselineSchedule, targetSchedule);
  const probs = historicalFeatures.behaviorProbabilities;
  const lunchRefinement = probabilityRefinementFactor(probs.lunchGivenLunchPresence);
  const dinnerRefinement = probabilityRefinementFactor(probs.dinnerGivenEveningPresence);
  const snackRefinement = probabilityRefinementFactor(probs.snackGivenLongGap);

  const weeklyLunch = historicalFeatures.lunchTransactionsPerWeek *
    historicalFeatures.avgSpendPerLunch * shifts.lunch * lunchRefinement;
  const weeklySnack = historicalFeatures.snackTransactionsPerWeek *
    historicalFeatures.avgSpendPerSnack * shifts.snack * snackRefinement;
  const weeklyDinner = historicalFeatures.dinnerTransactionsPerWeek *
    historicalFeatures.avgSpendPerDinner * shifts.dinner * dinnerRefinement;

  const miscWeekly = Math.max(
    0,
    historicalFeatures.avgWeeklySpend - weeklyLunch - weeklySnack - weeklyDinner,
  ) * (mode === "fall" ? 1.04 : 1);

  const termWeeks = TERM_WEEKS[mode];
  const baseCategoryBreakdown: CategoryDemandEstimate = {
    lunch: weeklyLunch * termWeeks,
    snack: weeklySnack * termWeeks,
    dinner: weeklyDinner * termWeeks,
    miscellaneous: miscWeekly * termWeeks,
  };

  const budgetAdjustment = applyBudgetPressureAdjustment({
    weeklySpendSeries: historicalFeatures.weeklySpendSeries,
    weeklyTxnCountSeries: historicalFeatures.weeklyTxnCountSeries,
    trendPerWeek: historicalFeatures.trendPerWeek,
    weeklySpendVolatility: historicalFeatures.weeklySpendVolatility,
    categoryBreakdown: baseCategoryBreakdown,
    termWeeks,
  });
  const categoryBreakdown = budgetAdjustment.adjustedCategoryBreakdown;

  const predictedTotalSpend = Object.values(categoryBreakdown).reduce(
    (sum, v) => sum + v,
    0,
  );

  const uncertaintyBase = mode === "fall" ? 0.28 : 0.16;
  const volatilityEffect = Math.min(0.28, historicalFeatures.weeklySpendVolatility / 120);
  const trendEffect = Math.min(0.18, Math.abs(historicalFeatures.trendPerWeek) / 8);
  const uncertaintyScore = Math.min(0.85, uncertaintyBase + volatilityEffect + trendEffect);

  const notes: string[] = [];
  if (mode === "fall") {
    notes.push(
      "Fall prediction uses your manually entered previous and future on-campus time patterns.",
    );
  }
  if (historicalFeatures.weeklySpendVolatility > 35) {
    notes.push("Historical spending is volatile; practical shortfall ranges may be wider.");
  }
  if (historicalFeatures.trendPerWeek > 1.5) {
    notes.push("Detected upward spending trend, so estimates include moderate growth.");
  }
  notes.push(...budgetAdjustment.notes);
  if (budgetAdjustment.adjustmentFactor !== 0) {
    const direction = budgetAdjustment.adjustmentFactor > 0 ? "upward" : "downward";
    notes.push(
      `Budget pressure module applied a small ${direction} demand adjustment (${Math.round(Math.abs(budgetAdjustment.adjustmentFactor) * 100)}%).`,
    );
  }
  notes.push(
    `Behavior probabilities (smoothed): lunch ${Math.round(probs.lunchGivenLunchPresence * 100)}%, dinner ${Math.round(probs.dinnerGivenEveningPresence * 100)}%, snack ${Math.round(probs.snackGivenLongGap * 100)}%.`,
  );

  return {
    profileLabel: profileLabelFromFeatures(historicalFeatures),
    predictedTotalSpend,
    categoryBreakdown,
    budgetSignals: budgetAdjustment.budgetSignals,
    uncertaintyScore,
    notes,
  };
}
