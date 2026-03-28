"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PipelineOutput } from "@/lib/analysis/pipeline";

interface ResultsDashboardProps {
  result: PipelineOutput;
}

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function ResultsDashboard({ result }: ResultsDashboardProps) {
  const { prediction, recommendation, rolloverEstimate } = result;

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
        <p className="text-sm font-medium text-slate-900">Reasoning snapshot</p>
        <p className="mt-2 text-sm text-slate-700">
          Budget signals: depletion {Math.round(prediction.budgetSignals.depletionScore * 100)}%,
          burn-down {Math.round(prediction.budgetSignals.burnDownScore * 100)}%.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {recommendation.reasoning.map((line) => (
            <li key={line}>- {line}</li>
          ))}
          {prediction.notes.map((line) => (
            <li key={line}>- {line}</li>
          ))}
          <li>- Rollover estimate used: {Math.round(rolloverEstimate)} points.</li>
        </ul>
      </div>
    </div>
  );
}
