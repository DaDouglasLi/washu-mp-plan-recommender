import { CategorizedTransaction, ScheduleFeatures, WeeklySpendFeatureSet } from "@/types/domain";
import { DAYS_PER_WEEK } from "@/lib/on-campus-time";
import { clusterProfileLabel } from "./clustering";

function weekKey(date: Date): string {
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const day = Math.floor((date.getTime() - firstJan.getTime()) / 86400000);
  return `${date.getFullYear()}-w${Math.floor(day / 7)}`;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function linearTrend(values: number[]): number {
  if (values.length < 3) return 0;
  let xSum = 0;
  let ySum = 0;
  let xySum = 0;
  let xxSum = 0;
  values.forEach((v, i) => {
    xSum += i;
    ySum += v;
    xySum += i * v;
    xxSum += i * i;
  });
  const n = values.length;
  const denom = n * xxSum - xSum * xSum;
  if (denom === 0) return 0;
  return (n * xySum - xSum * ySum) / denom;
}

function smoothedProbability(
  count: number,
  total: number,
  alpha = 1,
  beta = 2,
): number {
  // Bayesian/Laplace-style smoothing for sparse per-user data:
  // P = (count + alpha) / (total + beta)
  return (count + alpha) / (Math.max(0, total) + beta);
}

export function buildWeeklySpendFeatures(
  txns: CategorizedTransaction[],
  schedule: ScheduleFeatures,
): WeeklySpendFeatureSet {
  if (txns.length === 0) {
    return {
      avgWeeklySpend: 0,
      avgWeeklyTransactions: 0,
      weeklySpendSeries: [],
      weeklyTxnCountSeries: [],
      lunchTransactionsPerWeek: 0,
      dinnerTransactionsPerWeek: 0,
      snackTransactionsPerWeek: 0,
      avgSpendPerLunch: 0,
      avgSpendPerDinner: 0,
      avgSpendPerSnack: 0,
      weekdaySpendRatio: 0,
      lunchWhenOnCampusProb: 0,
      dinnerWhenOnCampusProb: 0,
      snackDuringLongGapProb: 0,
      behaviorProbabilities: {
        lunchGivenLunchPresence: 0.5,
        dinnerGivenEveningPresence: 0.5,
        snackGivenLongGap: 0.5,
      },
      weeklySpendVolatility: 0,
      trendPerWeek: 0,
    };
  }

  const weeklyTotals = new Map<string, { spend: number; count: number }>();
  txns.forEach((txn) => {
    const key = weekKey(txn.date);
    const bucket = weeklyTotals.get(key) ?? { spend: 0, count: 0 };
    bucket.spend += txn.amount;
    bucket.count += 1;
    weeklyTotals.set(key, bucket);
  });
  const orderedWeeklyTotals = Array.from(weeklyTotals.entries())
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, value]) => value);
  const weeklySpendSeries = orderedWeeklyTotals.map((value) => value.spend);
  const weeklyCountSeries = orderedWeeklyTotals.map((value) => value.count);
  const weekCount = Math.max(weeklyTotals.size, 1);

  const lunchTx = txns.filter((t) => t.category === "lunch");
  const dinnerTx = txns.filter((t) => t.category === "dinner");
  const snackTx = txns.filter((t) => t.category === "snack");
  const weekdaySpend = txns
    .filter((t) => t.weekday >= 1 && t.weekday <= 5)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSpend = txns.reduce((sum, t) => sum + t.amount, 0);
  const lunchDays = new Set(lunchTx.map((t) => `${t.date.toDateString()}`)).size;
  const dinnerDays = new Set(dinnerTx.map((t) => `${t.date.toDateString()}`)).size;

  const snackDuringGap = snackTx.filter((t) => t.hour >= 14.5 && t.hour <= 17.5).length;
  const longGapProxy = schedule.avgLongestGapMinutes >= 90 ? 1 : 0.6;
  const lunchPresenceDaysTotal = Math.round((weekCount * schedule.lunchPresenceDays) / DAYS_PER_WEEK);
  const dinnerPresenceDaysTotal = Math.round(
    (weekCount * schedule.dinnerPresenceDays) / DAYS_PER_WEEK,
  );
  const longGapDayLikelihood = Math.min(
    1,
    Math.max(0, (schedule.avgLongestGapMinutes - 60) / 180),
  );
  const longGapDaysTotal = Math.round(weekCount * DAYS_PER_WEEK * longGapDayLikelihood);
  const snackGapDays = new Set(
    snackTx
      .filter((t) => t.hour >= 14.5 && t.hour <= 17.5)
      .map((t) => t.date.toDateString()),
  ).size;

  const lunchGivenLunchPresence = smoothedProbability(lunchDays, lunchPresenceDaysTotal);
  const dinnerGivenEveningPresence = smoothedProbability(
    dinnerDays,
    dinnerPresenceDaysTotal,
  );
  const snackGivenLongGap = smoothedProbability(snackGapDays, longGapDaysTotal);

  return {
    avgWeeklySpend: mean(weeklySpendSeries),
    avgWeeklyTransactions: mean(weeklyCountSeries),
    weeklySpendSeries,
    weeklyTxnCountSeries: weeklyCountSeries,
    lunchTransactionsPerWeek: lunchTx.length / weekCount,
    dinnerTransactionsPerWeek: dinnerTx.length / weekCount,
    snackTransactionsPerWeek: snackTx.length / weekCount,
    avgSpendPerLunch: lunchTx.length > 0 ? lunchTx.reduce((s, t) => s + t.amount, 0) / lunchTx.length : 0,
    avgSpendPerDinner: dinnerTx.length > 0 ? dinnerTx.reduce((s, t) => s + t.amount, 0) / dinnerTx.length : 0,
    avgSpendPerSnack: snackTx.length > 0 ? snackTx.reduce((s, t) => s + t.amount, 0) / snackTx.length : 0,
    weekdaySpendRatio: totalSpend > 0 ? weekdaySpend / totalSpend : 0,
    lunchWhenOnCampusProb: lunchGivenLunchPresence,
    dinnerWhenOnCampusProb: dinnerGivenEveningPresence,
    snackDuringLongGapProb: snackTx.length > 0 ? Math.min(1, (snackDuringGap / snackTx.length) * longGapProxy) : snackGivenLongGap,
    behaviorProbabilities: {
      lunchGivenLunchPresence,
      dinnerGivenEveningPresence,
      snackGivenLongGap,
    },
    weeklySpendVolatility: std(weeklySpendSeries),
    trendPerWeek: linearTrend(weeklySpendSeries),
  };
}

export function profileLabelFromFeatures(features: WeeklySpendFeatureSet): string {
  const clustered = clusterProfileLabel({
    lunchTxnRate: features.lunchTransactionsPerWeek,
    snackTxnRate: features.snackTransactionsPerWeek,
    dinnerTxnRate: features.dinnerTransactionsPerWeek,
    avgWeeklySpend: features.avgWeeklySpend,
  });
  if (clustered) return clustered;

  if (features.avgWeeklySpend < 55 && features.weeklySpendVolatility < 20) {
    return "Low-Variance Light User";
  }
  if (features.snackTransactionsPerWeek > 4 && features.snackDuringLongGapProb > 0.45) {
    return "Frequent Afternoon Snacker";
  }
  if (features.dinnerTransactionsPerWeek > features.lunchTransactionsPerWeek * 1.2) {
    return "Evening-On-Campus Diner";
  }
  if (features.lunchTransactionsPerWeek >= features.dinnerTransactionsPerWeek) {
    return "Lunch-Driven";
  }
  return "High-Variance Flexible User";
}
