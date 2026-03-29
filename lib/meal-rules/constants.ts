import {
  ClassYear,
  MealPlan,
  MealPlanId,
  PredictionSemester,
} from "@/types/domain";

export const MEAL_PLANS: MealPlan[] = [
  { id: "platinum", name: "Platinum", points: 3557, costUsd: 4561 },
  { id: "gold", name: "Gold", points: 3184, costUsd: 4188 },
  { id: "silver", name: "Silver", points: 2604, costUsd: 3608 },
  { id: "bronze", name: "Bronze", points: 2012, costUsd: 3016 },
  { id: "apartment", name: "Apartment", points: 922, costUsd: 1358 },
  { id: "off-campus", name: "Off-Campus", points: 544, costUsd: 844 },
];

export const SEMESTER_BOUNDARY_RULES = {
  fall: {
    startMonth: 8,
    startDay: 20,
    endMonth: 12,
    endDay: 20,
  },
  spring: {
    startMonth: 1,
    startDay: 10,
    endMonth: 5,
    endDay: 10,
  },
} as const;

export const PLAN_BY_ID: Record<MealPlanId, MealPlan> = MEAL_PLANS.reduce(
  (acc, plan) => {
    acc[plan.id] = plan;
    return acc;
  },
  {} as Record<MealPlanId, MealPlan>,
);

export const TERM_WEEKS: Record<PredictionSemester, number> = {
  spring: 17,
  fall: 18,
};

export const DINING_WINDOWS = {
  breakfastEnd: 11 * 60,
  lunchEnd: 14 * 60 + 30,
  snackEnd: 17 * 60 + 30,
  dinnerEnd: 21 * 60 + 30,
};

export const LUNCH_WINDOW: [number, number] = [11 * 60, 14 * 60 + 30];
export const DINNER_WINDOW: [number, number] = [17 * 60 + 30, 21 * 60 + 30];

export function minimumEligiblePlanId(
  classYear: ClassYear,
  livingOnCampus: boolean,
): MealPlanId {
  if (classYear === "first-year") {
    return "silver";
  }

  if (livingOnCampus) {
    return "bronze";
  }

  return "off-campus";
}

const planRank: Record<MealPlanId, number> = {
  "off-campus": 0,
  apartment: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  platinum: 5,
};

export function eligiblePlans(
  classYear: ClassYear,
  livingOnCampus: boolean,
): MealPlan[] {
  const minPlanId = minimumEligiblePlanId(classYear, livingOnCampus);
  const minRank = planRank[minPlanId];
  return MEAL_PLANS.filter((plan) => planRank[plan.id] >= minRank);
}
