import { eligiblePlans } from "@/lib/meal-rules/constants";
import {
  ClassYear,
  MealPlan,
  PlanScore,
  PredictionSemester,
  RecommendationOutput,
} from "@/types/domain";

export interface RecommendInput {
  classYear: ClassYear;
  livingOnCampus: boolean;
  mode: PredictionSemester;
  predictedSpend: number;
  uncertaintyScore: number;
  rolloverPoints: number;
}

function scorePlan(
  plan: MealPlan,
  predictedSpend: number,
  rolloverPoints: number,
  uncertaintyScore: number,
  mode: PredictionSemester,
): PlanScore {
  const availablePoints = plan.points + rolloverPoints;
  const expectedShortfall = Math.max(0, predictedSpend - availablePoints);
  const expectedWaste = Math.max(0, availablePoints - predictedSpend);
  const expectedTotalCost = plan.costUsd + expectedShortfall;

  const shortfallTolerance = Math.max(240, predictedSpend * 0.14);
  const practicalityPenalty =
    expectedShortfall <= shortfallTolerance
      ? 0
      : (expectedShortfall - shortfallTolerance) * (1.2 + uncertaintyScore);

  const forfeiturePenalty = mode === "spring" ? expectedWaste * 0.42 : expectedWaste * 0.2;
  const totalScore = expectedTotalCost + practicalityPenalty + forfeiturePenalty;

  const rationale: string[] = [];
  if (expectedShortfall > 0) {
    rationale.push(
      `Estimated shortfall ${Math.round(expectedShortfall)} points can be covered by Bear Bucks or card.`,
    );
  }
  if (expectedWaste > 0 && mode === "spring") {
    rationale.push(
      `Spring leftover risk is ${Math.round(expectedWaste)} points (forfeited at spring end).`,
    );
  }
  if (practicalityPenalty > 0) {
    rationale.push("Shortfall may be too large for a practical day-to-day experience.");
  }

  return {
    plan,
    availablePoints,
    expectedShortfall,
    expectedWaste,
    expectedTotalCost,
    practicalityPenalty,
    totalScore,
    rationale,
  };
}

export function recommendPlan(input: RecommendInput): RecommendationOutput {
  const {
    classYear,
    livingOnCampus,
    mode,
    predictedSpend,
    uncertaintyScore,
    rolloverPoints,
  } = input;

  const plans = eligiblePlans(classYear, livingOnCampus);
  const scored = plans
    .map((plan) =>
      scorePlan(plan, predictedSpend, rolloverPoints, uncertaintyScore, mode),
    )
    .sort((a, b) => a.totalScore - b.totalScore);

  const cheapestPractical =
    scored.find((x) => x.practicalityPenalty <= 1) ?? scored[0];
  const recommended = scored[0];
  const conservative =
    scored.find((x) => x.expectedShortfall <= predictedSpend * 0.05) ??
    scored[scored.length - 1];

  const reasoning = [
    "The optimizer targets lowest expected total cost, not maximum point coverage.",
    "A moderate shortfall is treated as acceptable and often cheaper than overbuying points.",
    mode === "spring"
      ? "Spring leftover is penalized heavily because unused points are forfeited after spring."
      : "Fall leftover carries lower penalty because unused fall points roll into spring.",
  ];

  return {
    recommended,
    cheapestPractical,
    conservative,
    allEligible: scored,
    reasoning,
  };
}
