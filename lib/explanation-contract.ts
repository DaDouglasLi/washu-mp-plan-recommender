import { ClassYear, PredictionSemester } from "@/types/domain";

export interface ExplanationPlanSummary {
  name: string;
  points: number;
  costUsd: number;
  availablePoints: number;
  expectedShortfall: number;
  expectedWaste: number;
  expectedTotalCost: number;
  practicalityPenalty: number;
  rationale: string[];
}

export interface AnalysisExplanationPayload {
  predictionSemester: PredictionSemester;
  onCampusLiving: boolean;
  classYear: ClassYear;
  predictedTotalSpend: number;
  categoryBreakdown: {
    lunch: number;
    snack: number;
    dinner: number;
    misc: number;
  };
  recommendedPlan: ExplanationPlanSummary;
  cheapestPracticalPlan: ExplanationPlanSummary;
  conservativeOption: ExplanationPlanSummary;
  uncertaintyScore: number;
  profileLabel: string | null;
  budgetSignals: {
    depletionScore: number;
    burnDownScore: number;
  } | null;
  rolloverEstimate: number;
  reasoningFacts: string[];
}

export interface ExplanationResponse {
  explanation: string;
  alternatives: string[];
  caveats: string[];
}
