import {
  AnalysisExplanationPayload,
  ExplanationResponse,
} from "@/lib/explanation-contract";

export function buildFallbackExplanation(
  payload: AnalysisExplanationPayload,
): ExplanationResponse {
  const explanation = `${payload.recommendedPlan.name} is the current best money-saving recommendation because it has the lowest expected total cost once plan price, likely shortfall, and leftover-point risk are considered. Your predicted spend is about ${Math.round(payload.predictedTotalSpend)} points, with the largest pressure coming from lunch ${Math.round(payload.categoryBreakdown.lunch)}, snack ${Math.round(payload.categoryBreakdown.snack)}, and dinner ${Math.round(payload.categoryBreakdown.dinner)}.`;

  const alternatives = [
    `${payload.cheapestPracticalPlan.name} is the cheapest practical alternative if you want to keep shortfall manageable while staying cost-focused.`,
    `${payload.conservativeOption.name} is the safer higher-coverage alternative if you want to reduce the chance of needing extra out-of-pocket spending.`,
  ];

  const caveats = [
    `Uncertainty is ${Math.round(payload.uncertaintyScore * 100)}%, so the result should be treated as practical guidance rather than an exact outcome.`,
    payload.onCampusLiving
      ? "Full-day campus presence was assumed because you live on campus."
      : "The estimate depends on the on-campus time you entered, so changes in routine can shift the result.",
  ];

  if (payload.recommendedPlan.expectedShortfall > 0) {
    caveats.push(
      `${payload.recommendedPlan.name} still assumes about ${Math.round(payload.recommendedPlan.expectedShortfall)} points of out-of-pocket supplement.`,
    );
  }

  if (payload.predictionSemester === "spring" && payload.rolloverEstimate > 0) {
    caveats.push(`The spring recommendation includes an estimated rollover of ${Math.round(payload.rolloverEstimate)} points.`);
  }

  if (payload.budgetSignals?.depletionScore && payload.budgetSignals.depletionScore > 0.2) {
    caveats.push(
      "Late-semester spending dropped noticeably, which may suggest historical point depletion and a slightly conservative local adjustment upward.",
    );
  }

  if (payload.budgetSignals?.burnDownScore && payload.budgetSignals.burnDownScore > 0.2) {
    caveats.push(
      "Late-semester spending rose noticeably, which may suggest historical burn-down behavior and a slight local adjustment downward.",
    );
  }

  return {
    explanation,
    alternatives,
    caveats,
  };
}

export function buildFallbackStatusMessage(errorMessage?: string): string {
  return errorMessage
    ? `AI explanation unavailable: ${errorMessage}`
    : "AI explanation unavailable. Showing local summary instead.";
}
