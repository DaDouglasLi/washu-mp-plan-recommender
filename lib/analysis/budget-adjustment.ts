import { CategoryDemandEstimate } from "@/types/domain";

export interface BudgetSignals {
  depletionScore: number;
  burnDownScore: number;
}

export interface BudgetAdjustmentInput {
  weeklySpendSeries: number[];
  weeklyTxnCountSeries: number[];
  trendPerWeek: number;
  weeklySpendVolatility: number;
  categoryBreakdown: CategoryDemandEstimate;
  termWeeks: number;
}

export interface BudgetAdjustmentOutput {
  adjustedCategoryBreakdown: CategoryDemandEstimate;
  adjustmentFactor: number;
  budgetSignals: BudgetSignals;
  notes: string[];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ratio(valuesLate: number, valuesEarly: number): number {
  if (valuesEarly <= 0) {
    return 1;
  }

  return valuesLate / valuesEarly;
}

function normalizedMagnitude(
  actualRatio: number,
  thresholdRatio: number,
  strongestRatio: number,
): number {
  const span = Math.abs(thresholdRatio - strongestRatio);
  if (span === 0) return 0;
  return clamp(Math.abs(actualRatio - thresholdRatio) / span, 0, 1);
}

export function applyBudgetPressureAdjustment(
  input: BudgetAdjustmentInput,
): BudgetAdjustmentOutput {
  const { weeklySpendSeries, weeklyTxnCountSeries, trendPerWeek, categoryBreakdown, termWeeks } =
    input;

  if (weeklySpendSeries.length < 4) {
    return {
      adjustedCategoryBreakdown: categoryBreakdown,
      adjustmentFactor: 0,
      budgetSignals: { depletionScore: 0, burnDownScore: 0 },
      notes: [],
    };
  }

  const earlyEnd = Math.max(1, Math.ceil(weeklySpendSeries.length * 0.5));
  const lateStart = Math.min(
    weeklySpendSeries.length - 1,
    Math.floor(weeklySpendSeries.length * 0.75),
  );

  const earlySpend = weeklySpendSeries.slice(0, earlyEnd);
  const lateSpend = weeklySpendSeries.slice(lateStart);
  const earlyTxn = weeklyTxnCountSeries.slice(0, earlyEnd);
  const lateTxn = weeklyTxnCountSeries.slice(lateStart);

  const avgEarlySpend = mean(earlySpend);
  const avgLateSpend = mean(lateSpend);
  const avgEarlyTxn = mean(earlyTxn);
  const avgLateTxn = mean(lateTxn);

  const spendRatio = ratio(avgLateSpend, avgEarlySpend);
  const txnRatio = ratio(avgLateTxn, avgEarlyTxn);
  const coverageFactor = clamp(weeklySpendSeries.length / Math.max(6, termWeeks * 0.6), 0, 1);

  let depletionScore = 0;
  if (spendRatio < 0.7 && trendPerWeek < 0) {
    const spendDrop = normalizedMagnitude(spendRatio, 0.7, 0.35);
    const txnDrop = txnRatio < 1 ? normalizedMagnitude(txnRatio, 0.85, 0.45) : 0;
    depletionScore = clamp((spendDrop * 0.75 + txnDrop * 0.25) * coverageFactor, 0, 1);
  }

  let burnDownScore = 0;
  if (spendRatio > 1.3 && trendPerWeek > 0) {
    const spendRise = normalizedMagnitude(spendRatio, 1.3, 1.75);
    const txnRise = txnRatio > 1 ? normalizedMagnitude(txnRatio, 1.15, 1.55) : 0;
    burnDownScore = clamp((spendRise * 0.75 + txnRise * 0.25) * coverageFactor, 0, 1);
  }

  const depletionAdjustment = depletionScore > 0 ? 0.05 + depletionScore * 0.1 : 0;
  const burnDownAdjustment = burnDownScore > 0 ? 0.05 + burnDownScore * 0.1 : 0;
  const adjustmentFactor = clamp(depletionAdjustment - burnDownAdjustment, -0.15, 0.15);

  if (adjustmentFactor === 0) {
    return {
      adjustedCategoryBreakdown: categoryBreakdown,
      adjustmentFactor,
      budgetSignals: { depletionScore, burnDownScore },
      notes: [],
    };
  }

  const baseTotal = Object.values(categoryBreakdown).reduce((sum, value) => sum + value, 0);
  const targetDelta = baseTotal * adjustmentFactor;
  const categoryWeights = {
    lunch: categoryBreakdown.lunch * 0.2,
    snack: categoryBreakdown.snack * 1,
    dinner: categoryBreakdown.dinner * 0.9,
    miscellaneous: categoryBreakdown.miscellaneous * 0.5,
  };
  const totalWeight = Object.values(categoryWeights).reduce((sum, value) => sum + value, 0);

  const adjustedCategoryBreakdown =
    totalWeight > 0
      ? {
          lunch: Math.max(
            0,
            categoryBreakdown.lunch + (targetDelta * categoryWeights.lunch) / totalWeight,
          ),
          snack: Math.max(
            0,
            categoryBreakdown.snack + (targetDelta * categoryWeights.snack) / totalWeight,
          ),
          dinner: Math.max(
            0,
            categoryBreakdown.dinner + (targetDelta * categoryWeights.dinner) / totalWeight,
          ),
          miscellaneous: Math.max(
            0,
            categoryBreakdown.miscellaneous +
              (targetDelta * categoryWeights.miscellaneous) / totalWeight,
          ),
        }
      : categoryBreakdown;

  const notes: string[] = [];
  if (depletionScore > 0) {
    notes.push(
      "Your spending dropped significantly late in the semester, which may indicate meal point depletion.",
    );
  }
  if (burnDownScore > 0) {
    notes.push(
      "Your spending increased near the end of the semester, which may indicate using remaining meal points.",
    );
  }

  return {
    adjustedCategoryBreakdown,
    adjustmentFactor,
    budgetSignals: { depletionScore, burnDownScore },
    notes,
  };
}
