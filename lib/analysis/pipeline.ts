import { PLAN_BY_ID, SEMESTERS } from "@/lib/meal-rules/constants";
import {
  countCompletedTimeBlocks,
  deriveScheduleFeaturesFromTimeBlocks,
  fullDayCampusFeatures,
  validateOnCampusTimeBlocks,
} from "@/lib/on-campus-time";
import { parseMealHistory, } from "@/lib/parsing/meal-history";
import { GenericRow } from "@/lib/parsing/tabular";
import { recommendPlan } from "@/lib/recommendation/engine";
import {
  ClassYear,
  MealPlanId,
  OnCampusTimeBlock,
  ParsedMealTransaction,
  PredictionSemester,
  ScheduleFeatures,
} from "@/types/domain";
import { buildWeeklySpendFeatures } from "./features";
import { predictNextSemesterDemand } from "./predictor";
import { categorizeTransactions } from "./spending-classifier";

export interface PipelineInput {
  mode: PredictionSemester;
  classYear: ClassYear;
  livingOnCampus: boolean;
  mealRows: GenericRow[];
  previousFallCampusTime?: OnCampusTimeBlock[];
  previousSpringCampusTime?: OnCampusTimeBlock[];
  futureSpringCampusTime?: OnCampusTimeBlock[];
  futureFallCampusTime?: OnCampusTimeBlock[];
  knownFallPlanId?: MealPlanId | "unknown";
  knownCurrentBalance?: number;
}

export interface PipelineOutput {
  stats: {
    parsedMeals: number;
    previousFallTimeBlocks: number;
    previousSpringTimeBlocks: number;
    futureSpringTimeBlocks: number;
    futureFallTimeBlocks: number;
    usedFullDayCampusAssumption: boolean;
  };
  prediction: ReturnType<typeof predictNextSemesterDemand>;
  recommendation: ReturnType<typeof recommendPlan>;
  rolloverEstimate: number;
}

function estimateRolloverPoints(
  input: PipelineInput,
  historicalSpend: number,
): number {
  if (input.mode !== "spring") return 0;
  if (typeof input.knownCurrentBalance === "number" && input.knownCurrentBalance >= 0) {
    return input.knownCurrentBalance;
  }
  if (input.knownFallPlanId && input.knownFallPlanId !== "unknown") {
    const plan = PLAN_BY_ID[input.knownFallPlanId];
    return Math.max(0, plan.points - historicalSpend);
  }
  return Math.max(0, 220 - historicalSpend * 0.06);
}

function weightedAverage(a: number, b: number, weightForA: number): number {
  return a * weightForA + b * (1 - weightForA);
}

function semesterRange(key: "fall-2026" | "spring-2027"): { startMs: number; endMs: number } {
  const range = SEMESTERS.find((semester) => semester.key === key);
  if (!range) {
    throw new Error(`Missing semester range for ${key}.`);
  }

  return {
    startMs: new Date(`${range.startIso}T00:00:00`).getTime(),
    endMs: new Date(`${range.endIso}T23:59:59.999`).getTime(),
  };
}

function inRange(date: Date, startMs: number, endMs: number): boolean {
  const timestamp = date.getTime();
  return timestamp >= startMs && timestamp <= endMs;
}

function selectRelevantTransactions(
  txns: ParsedMealTransaction[],
  mode: PredictionSemester,
): {
  selected: ParsedMealTransaction[];
  ignoredOlderSpringData: boolean;
  excludedPartialCurrentSpring: boolean;
} {
  const fall = semesterRange("fall-2026");
  const spring = semesterRange("spring-2027");

  const previousFallTxns = txns.filter((txn) => inRange(txn.date, fall.startMs, fall.endMs));
  const springTxns = txns.filter((txn) => inRange(txn.date, spring.startMs, spring.endMs));

  if (mode === "spring") {
    return {
      selected: previousFallTxns,
      ignoredOlderSpringData: springTxns.length > 0,
      excludedPartialCurrentSpring: false,
    };
  }

  const hasCompleteSpringCoverage =
    springTxns.length > 0 &&
    springTxns[springTxns.length - 1].date.getTime() >= spring.endMs;

  return {
    selected: hasCompleteSpringCoverage
      ? [...previousFallTxns, ...springTxns]
      : previousFallTxns,
    ignoredOlderSpringData: false,
    excludedPartialCurrentSpring: springTxns.length > 0 && !hasCompleteSpringCoverage,
  };
}

function resolveScheduleFeatures(
  blocks: OnCampusTimeBlock[] | undefined,
  label: string,
  livingOnCampus: boolean,
): { features: ScheduleFeatures; blockCount: number } {
  if (livingOnCampus) {
    return {
      features: fullDayCampusFeatures(),
      blockCount: 0,
    };
  }

  const inputBlocks = blocks ?? [];
  const errors = validateOnCampusTimeBlocks(inputBlocks, label);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  return {
    features: deriveScheduleFeaturesFromTimeBlocks(inputBlocks),
    blockCount: countCompletedTimeBlocks(inputBlocks),
  };
}

export function runFullAnalysis(input: PipelineInput): PipelineOutput {
  const txns = parseMealHistory(input.mealRows);
  const relevantTransactions = selectRelevantTransactions(txns, input.mode);
  if (relevantTransactions.selected.length < 8) {
    throw new Error(
      "Not enough valid meal transactions found for the relevant historical semester data.",
    );
  }
  const categorized = categorizeTransactions(relevantTransactions.selected);

  const previousFall = resolveScheduleFeatures(
    input.previousFallCampusTime,
    "Previous fall on-campus time",
    input.livingOnCampus,
  );
  const previousSpring =
    input.mode === "fall"
      ? resolveScheduleFeatures(
          input.previousSpringCampusTime,
          "Previous spring on-campus time",
          input.livingOnCampus,
        )
      : null;
  const futureSpring =
    input.mode === "spring"
      ? resolveScheduleFeatures(
          input.futureSpringCampusTime,
          "Future spring on-campus time",
          input.livingOnCampus,
        )
      : null;
  const futureFall =
    input.mode === "fall"
      ? resolveScheduleFeatures(
          input.futureFallCampusTime,
          "Future fall on-campus time",
          input.livingOnCampus,
        )
      : null;

  const baselineSchedule =
    input.mode === "spring"
      ? previousFall.features
      : {
          lunchPresenceDays: weightedAverage(
            previousFall.features.lunchPresenceDays,
            previousSpring!.features.lunchPresenceDays,
            0.5,
          ),
          dinnerPresenceDays: weightedAverage(
            previousFall.features.dinnerPresenceDays,
            previousSpring!.features.dinnerPresenceDays,
            0.5,
          ),
          avgLongestGapMinutes: weightedAverage(
            previousFall.features.avgLongestGapMinutes,
            previousSpring!.features.avgLongestGapMinutes,
            0.5,
          ),
          avgTotalCampusMinutes: weightedAverage(
            previousFall.features.avgTotalCampusMinutes,
            previousSpring!.features.avgTotalCampusMinutes,
            0.5,
          ),
          eveningPresenceDays: weightedAverage(
            previousFall.features.eveningPresenceDays,
            previousSpring!.features.eveningPresenceDays,
            0.5,
          ),
        };

  const targetSchedule = input.mode === "spring" ? futureSpring!.features : futureFall!.features;

  const spendFeatures = buildWeeklySpendFeatures(categorized, baselineSchedule);
  const prediction = predictNextSemesterDemand({
    mode: input.mode,
    historicalFeatures: spendFeatures,
    baselineSchedule,
    targetSchedule,
  });
  if (relevantTransactions.ignoredOlderSpringData) {
    prediction.notes.push(
      "Older spring transaction rows were ignored so spring-mode modeling stays anchored to the previous fall term.",
    );
  }
  if (relevantTransactions.excludedPartialCurrentSpring) {
    prediction.notes.push(
      "Current spring transaction history appeared incomplete and was excluded from fall-mode behavioral modeling.",
    );
  }

  const historicalSpend = relevantTransactions.selected.reduce((sum, t) => sum + t.amount, 0);
  const rolloverEstimate = estimateRolloverPoints(input, historicalSpend);

  const recommendation = recommendPlan({
    classYear: input.classYear,
    livingOnCampus: input.livingOnCampus,
    mode: input.mode,
    predictedSpend: prediction.predictedTotalSpend,
    uncertaintyScore: prediction.uncertaintyScore,
    rolloverPoints: rolloverEstimate,
  });

  return {
    stats: {
      parsedMeals: relevantTransactions.selected.length,
      previousFallTimeBlocks: previousFall.blockCount,
      previousSpringTimeBlocks: previousSpring?.blockCount ?? 0,
      futureSpringTimeBlocks: futureSpring?.blockCount ?? 0,
      futureFallTimeBlocks: futureFall?.blockCount ?? 0,
      usedFullDayCampusAssumption: input.livingOnCampus,
    },
    prediction,
    recommendation,
    rolloverEstimate,
  };
}
