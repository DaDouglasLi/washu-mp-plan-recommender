import { AnalysisExplanationPayload, ExplanationResponse } from "@/lib/explanation-contract";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";

export const runtime = "nodejs";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlanSummary(value: unknown): value is AnalysisExplanationPayload["recommendedPlan"] {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  return (
    typeof plan.name === "string" &&
    typeof plan.points === "number" &&
    typeof plan.costUsd === "number" &&
    typeof plan.availablePoints === "number" &&
    typeof plan.expectedShortfall === "number" &&
    typeof plan.expectedWaste === "number" &&
    typeof plan.expectedTotalCost === "number" &&
    typeof plan.practicalityPenalty === "number" &&
    isStringArray(plan.rationale)
  );
}

function isExplanationPayload(value: unknown): value is AnalysisExplanationPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;
  const categoryBreakdown = payload.categoryBreakdown as Record<string, unknown> | undefined;
  const budgetSignals = payload.budgetSignals as Record<string, unknown> | null | undefined;

  return (
    (payload.predictionSemester === "spring" || payload.predictionSemester === "fall") &&
    typeof payload.onCampusLiving === "boolean" &&
    typeof payload.classYear === "string" &&
    typeof payload.predictedTotalSpend === "number" &&
    !!categoryBreakdown &&
    typeof categoryBreakdown.lunch === "number" &&
    typeof categoryBreakdown.snack === "number" &&
    typeof categoryBreakdown.dinner === "number" &&
    typeof categoryBreakdown.misc === "number" &&
    isPlanSummary(payload.recommendedPlan) &&
    isPlanSummary(payload.cheapestPracticalPlan) &&
    isPlanSummary(payload.conservativeOption) &&
    typeof payload.uncertaintyScore === "number" &&
    (payload.profileLabel === null || typeof payload.profileLabel === "string") &&
    (budgetSignals == null ||
      (typeof budgetSignals.depletionScore === "number" &&
        typeof budgetSignals.burnDownScore === "number")) &&
    typeof payload.rolloverEstimate === "number" &&
    isStringArray(payload.reasoningFacts)
  );
}

function extractTextResponse(outputText: string): ExplanationResponse {
  const parsed = JSON.parse(outputText) as Partial<ExplanationResponse>;
  return {
    explanation:
      typeof parsed.explanation === "string"
        ? parsed.explanation
        : "No explanation returned.",
    alternatives: isStringArray(parsed.alternatives) ? parsed.alternatives : [],
    caveats: isStringArray(parsed.caveats) ? parsed.caveats : [],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isExplanationPayload(body)) {
      return Response.json({ error: "Invalid explanation payload." }, { status: 400 });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a careful, practical WashU meal plan advisor. Use only the supplied analysis data. Do not invent policies, numbers, or behaviors. Focus on minimizing expected total cost, not maximizing meal point coverage. Explain tradeoffs clearly, mention cheaper and safer alternatives, and be careful about uncertainty. Return strict JSON with keys explanation, alternatives, and caveats. explanation must be a single paragraph string. alternatives and caveats must be arrays of short strings.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(body),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meal_plan_explanation",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              explanation: { type: "string" },
              alternatives: {
                type: "array",
                items: { type: "string" },
              },
              caveats: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["explanation", "alternatives", "caveats"],
          },
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      return Response.json({ error: "No explanation returned from OpenAI." }, { status: 502 });
    }

    return Response.json(extractTextResponse(outputText));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Explanation request failed.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
