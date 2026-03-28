"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AnalysisExplanationPayload,
  ExplanationResponse,
} from "@/lib/explanation-contract";
import {
  buildFallbackExplanation,
  buildFallbackStatusMessage,
} from "@/lib/explanation-fallback";
import { PipelineOutput } from "@/lib/analysis/pipeline";
import { ClassYear, PredictionSemester } from "@/types/domain";

interface ResultsDashboardProps {
  result: PipelineOutput;
  predictionSemester: PredictionSemester;
  classYear: ClassYear;
  livingOnCampus: boolean;
}

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function toExplanationPayload(
  result: PipelineOutput,
  predictionSemester: PredictionSemester,
  classYear: ClassYear,
  livingOnCampus: boolean,
): AnalysisExplanationPayload {
  return {
    predictionSemester,
    onCampusLiving: livingOnCampus,
    classYear,
    predictedTotalSpend: result.prediction.predictedTotalSpend,
    categoryBreakdown: {
      lunch: result.prediction.categoryBreakdown.lunch,
      snack: result.prediction.categoryBreakdown.snack,
      dinner: result.prediction.categoryBreakdown.dinner,
      misc: result.prediction.categoryBreakdown.miscellaneous,
    },
    recommendedPlan: {
      name: result.recommendation.recommended.plan.name,
      points: result.recommendation.recommended.plan.points,
      costUsd: result.recommendation.recommended.plan.costUsd,
      availablePoints: result.recommendation.recommended.availablePoints,
      expectedShortfall: result.recommendation.recommended.expectedShortfall,
      expectedWaste: result.recommendation.recommended.expectedWaste,
      expectedTotalCost: result.recommendation.recommended.expectedTotalCost,
      practicalityPenalty: result.recommendation.recommended.practicalityPenalty,
      rationale: result.recommendation.recommended.rationale,
    },
    cheapestPracticalPlan: {
      name: result.recommendation.cheapestPractical.plan.name,
      points: result.recommendation.cheapestPractical.plan.points,
      costUsd: result.recommendation.cheapestPractical.plan.costUsd,
      availablePoints: result.recommendation.cheapestPractical.availablePoints,
      expectedShortfall: result.recommendation.cheapestPractical.expectedShortfall,
      expectedWaste: result.recommendation.cheapestPractical.expectedWaste,
      expectedTotalCost: result.recommendation.cheapestPractical.expectedTotalCost,
      practicalityPenalty: result.recommendation.cheapestPractical.practicalityPenalty,
      rationale: result.recommendation.cheapestPractical.rationale,
    },
    conservativeOption: {
      name: result.recommendation.conservative.plan.name,
      points: result.recommendation.conservative.plan.points,
      costUsd: result.recommendation.conservative.plan.costUsd,
      availablePoints: result.recommendation.conservative.availablePoints,
      expectedShortfall: result.recommendation.conservative.expectedShortfall,
      expectedWaste: result.recommendation.conservative.expectedWaste,
      expectedTotalCost: result.recommendation.conservative.expectedTotalCost,
      practicalityPenalty: result.recommendation.conservative.practicalityPenalty,
      rationale: result.recommendation.conservative.rationale,
    },
    uncertaintyScore: result.prediction.uncertaintyScore,
    profileLabel: result.prediction.profileLabel ?? null,
    budgetSignals: result.prediction.budgetSignals ?? null,
    rolloverEstimate: result.rolloverEstimate,
    reasoningFacts: [
      ...result.recommendation.reasoning,
      ...result.recommendation.recommended.rationale,
      ...result.recommendation.cheapestPractical.rationale,
      ...result.recommendation.conservative.rationale,
      ...result.prediction.notes,
    ],
  };
}

export function ResultsDashboard({
  result,
  predictionSemester,
  classYear,
  livingOnCampus,
}: ResultsDashboardProps) {
  const { prediction, recommendation, rolloverEstimate } = result;
  const explanationPayload = useMemo(
    () => toExplanationPayload(result, predictionSemester, classYear, livingOnCampus),
    [classYear, livingOnCampus, predictionSemester, result],
  );
  const [aiExplanation, setAiExplanation] = useState<ExplanationResponse>(
    buildFallbackExplanation(explanationPayload),
  );
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationStatus, setExplanationStatus] = useState("");

  const categoryData = [
    { name: "Lunch", points: prediction.categoryBreakdown.lunch },
    { name: "Snack", points: prediction.categoryBreakdown.snack },
    { name: "Dinner", points: prediction.categoryBreakdown.dinner },
    { name: "Misc", points: prediction.categoryBreakdown.miscellaneous },
  ];

  const planData = recommendation.allEligible.map((planScore) => ({
    name: planScore.plan.name,
    totalCost: planScore.expectedTotalCost,
    shortfall: planScore.expectedShortfall,
    waste: planScore.expectedWaste,
  }));

  useEffect(() => {
    let isCancelled = false;

    async function loadExplanation() {
      setIsLoadingExplanation(true);
      setExplanationStatus("");
      setAiExplanation(buildFallbackExplanation(explanationPayload));

      try {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(explanationPayload),
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(errorBody?.error || "Explanation request failed.");
        }

        const data = (await response.json()) as ExplanationResponse;
        if (isCancelled) {
          return;
        }

        setAiExplanation({
          explanation: data.explanation,
          alternatives: data.alternatives ?? [],
          caveats: data.caveats ?? [],
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setAiExplanation(buildFallbackExplanation(explanationPayload));
        setExplanationStatus(
          buildFallbackStatusMessage(
            error instanceof Error ? error.message : undefined,
          ),
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingExplanation(false);
        }
      }
    }

    void loadExplanation();

    return () => {
      isCancelled = true;
    };
  }, [explanationPayload]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-indigo-50 p-4">
          <p className="text-sm text-indigo-700">Recommended Plan</p>
          <p className="text-2xl font-semibold text-indigo-900">{recommendation.recommended.plan.name}</p>
          <p className="mt-1 text-sm text-indigo-800">
            Expected total cost: {usd(recommendation.recommended.expectedTotalCost)}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Cheapest Practical Option</p>
          <p className="text-2xl font-semibold text-emerald-900">{recommendation.cheapestPractical.plan.name}</p>
          <p className="mt-1 text-sm text-emerald-800">
            Expected shortfall: {Math.round(recommendation.cheapestPractical.expectedShortfall)} points
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-sm text-amber-700">Conservative Option</p>
          <p className="text-2xl font-semibold text-amber-900">{recommendation.conservative.plan.name}</p>
          <p className="mt-1 text-sm text-amber-800">
            Lower shortfall risk, higher overbuy risk
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-2 text-base font-semibold text-slate-900">
            Predicted On-Campus Spend by Category
          </h3>
          <p className="mb-3 text-sm text-slate-600">
            Predicted semester total: {Math.round(prediction.predictedTotalSpend)} points
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="points" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-2 text-base font-semibold text-slate-900">
            Eligible Plan Cost Comparison
          </h3>
          <p className="mb-3 text-sm text-slate-600">
            Includes out-of-pocket supplement when points are insufficient
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? usd(value) : String(value)
                  }
                />
                <Bar dataKey="totalCost" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-900">AI explanation</p>
        {isLoadingExplanation ? (
          <p className="mt-2 text-sm text-slate-600">Generating AI explanation...</p>
        ) : null}
        {explanationStatus ? (
          <p className="mt-2 text-sm text-amber-800">{explanationStatus}</p>
        ) : null}
        <p className="mt-2 text-sm text-slate-700">{aiExplanation.explanation}</p>
        <p className="mt-3 text-sm text-slate-700">
          Budget signals: depletion {Math.round(prediction.budgetSignals.depletionScore * 100)}%,
          burn-down {Math.round(prediction.budgetSignals.burnDownScore * 100)}%.
        </p>
        {aiExplanation.alternatives.length > 0 ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-900">Alternatives</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {aiExplanation.alternatives.map((line) => (
                <li key={line}>- {line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-3">
          <p className="text-sm font-medium text-slate-900">Caveats</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {aiExplanation.caveats.map((line) => (
              <li key={line}>- {line}</li>
            ))}
            <li>- Rollover estimate used: {Math.round(rolloverEstimate)} points.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
