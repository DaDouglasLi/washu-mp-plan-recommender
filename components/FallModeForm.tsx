"use client";

import { useEffect, useState } from "react";
import { FileUploadField } from "@/components/FileUploadField";
import { OnCampusTimeSection } from "@/components/OnCampusTimeSection";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { SectionCard } from "@/components/SectionCard";
import {
  CLASS_YEAR_OPTIONS,
  emptyUploadSlotState,
  type UploadSlotState,
  validateMealHistoryFile,
  validatingUploadSlotState,
} from "@/lib/prediction-form";
import { validateOnCampusTimeBlocks } from "@/lib/on-campus-time";
import { runFullAnalysis, type PipelineOutput } from "@/lib/analysis/pipeline";
import { parseTabularFile } from "@/lib/parsing/tabular";
import { ClassYear, OnCampusTimeBlock } from "@/types/domain";

interface FallFormSnapshot {
  classYear: ClassYear;
  livingOnCampus: boolean;
  mealHistory: UploadSlotState;
  previousFallTime: OnCampusTimeBlock[];
  previousSpringTime: OnCampusTimeBlock[];
  futureFallTime: OnCampusTimeBlock[];
}

let inMemoryFallSnapshot: FallFormSnapshot | null = null;

export function FallModeForm() {
  const [classYear, setClassYear] = useState<ClassYear>(
    inMemoryFallSnapshot?.classYear ?? "sophomore",
  );
  const [livingOnCampus, setLivingOnCampus] = useState(
    inMemoryFallSnapshot?.livingOnCampus ?? true,
  );
  const [mealHistory, setMealHistory] = useState<UploadSlotState>(
    inMemoryFallSnapshot?.mealHistory ?? emptyUploadSlotState(),
  );
  const [previousFallTime, setPreviousFallTime] = useState<OnCampusTimeBlock[]>(
    inMemoryFallSnapshot?.previousFallTime ?? [],
  );
  const [previousSpringTime, setPreviousSpringTime] = useState<OnCampusTimeBlock[]>(
    inMemoryFallSnapshot?.previousSpringTime ?? [],
  );
  const [futureFallTime, setFutureFallTime] = useState<OnCampusTimeBlock[]>(
    inMemoryFallSnapshot?.futureFallTime ?? [],
  );
  const [result, setResult] = useState<PipelineOutput | null>(null);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const previousFallErrors = livingOnCampus
    ? []
    : validateOnCampusTimeBlocks(previousFallTime, "Previous fall on-campus time");
  const previousSpringErrors = livingOnCampus
    ? []
    : validateOnCampusTimeBlocks(previousSpringTime, "Previous spring on-campus time");
  const futureFallErrors = livingOnCampus
    ? []
    : validateOnCampusTimeBlocks(futureFallTime, "Future fall on-campus time");

  const blockingRequirements: string[] = [];

  if (mealHistory.status !== "valid") {
    if (mealHistory.status === "empty") {
      blockingRequirements.push("Meal transactions CSV: no file selected");
    } else if (mealHistory.status === "selected" || mealHistory.status === "validating") {
      blockingRequirements.push("Meal transactions CSV: validation in progress");
    } else {
      blockingRequirements.push(`Meal transactions CSV: ${mealHistory.message}`);
    }
  }

  if (!livingOnCampus) {
    blockingRequirements.push(
      ...previousFallErrors,
      ...previousSpringErrors,
      ...futureFallErrors,
    );
  }

  const canAnalyze = blockingRequirements.length === 0;

  useEffect(() => {
    inMemoryFallSnapshot = {
      classYear,
      livingOnCampus,
      mealHistory,
      previousFallTime,
      previousSpringTime,
      futureFallTime,
    };
  }, [
    classYear,
    futureFallTime,
    livingOnCampus,
    mealHistory,
    previousFallTime,
    previousSpringTime,
  ]);

  function updateLivingOnCampus(nextValue: boolean) {
    setLivingOnCampus(nextValue);
    setResult(null);
    setError("");
  }

  function updatePreviousFallTime(nextValue: OnCampusTimeBlock[]) {
    setPreviousFallTime(nextValue);
    setResult(null);
    setError("");
  }

  function updatePreviousSpringTime(nextValue: OnCampusTimeBlock[]) {
    setPreviousSpringTime(nextValue);
    setResult(null);
    setError("");
  }

  function updateFutureFallTime(nextValue: OnCampusTimeBlock[]) {
    setFutureFallTime(nextValue);
    setResult(null);
    setError("");
  }

  async function validateMealFile(file: File | null) {
    if (!file) {
      setMealHistory(emptyUploadSlotState());
      setResult(null);
      setError("");
      return;
    }

    setMealHistory(validatingUploadSlotState(file));
    setResult(null);
    setError("");

    const nextState = await validateMealHistoryFile(file);
    setMealHistory(nextState);
  }

  async function runAnalysis() {
    if (!canAnalyze) {
      setError("Please complete the required fall inputs before running analysis.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setError("");

      const mealRows = await parseTabularFile(mealHistory.file as File);

      const output = runFullAnalysis({
        mode: "fall",
        classYear,
        livingOnCampus,
        mealRows,
        previousFallCampusTime: previousFallTime,
        previousSpringCampusTime: previousSpringTime,
        futureFallCampusTime: futureFallTime,
      });

      setResult(output);
    } catch (analysisError) {
      setError(
        analysisError instanceof Error ? analysisError.message : "Analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="2) Fall Student Context"
        subtitle="Fall mode keeps its own student context and its own required upload set."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-800">
              Class year next semester
            </span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={classYear}
              onChange={(event) => setClassYear(event.target.value as ClassYear)}
            >
              {CLASS_YEAR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-800">
              Live on campus?
            </span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={livingOnCampus ? "yes" : "no"}
              onChange={(event) => updateLivingOnCampus(event.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <p className="font-medium">Required fall inputs</p>
            <p className="mt-1">
              {livingOnCampus
                ? "Meal transactions CSV only. On-campus students use the full-day campus assumption."
                : "Meal transactions CSV, previous fall on-campus time, previous spring on-campus time, and future fall on-campus time."}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="3) Fall Inputs"
        subtitle="Manual on-campus time replaces schedule file uploads."
      >
        <div className="grid gap-4">
          <FileUploadField
            label="Meal transactions CSV"
            description="Upload the Mealpoints account statement CSV from Atrium: Account Management -> Account Statements -> choose Mealpoints -> set period to Last 9 Month."
            required
            accept=".csv"
            fileName={mealHistory.fileName}
            fileSizeBytes={mealHistory.fileSizeBytes}
            status={mealHistory.status}
            statusMessage={mealHistory.message}
            onFileSelect={(file) => void validateMealFile(file)}
          />
        </div>

        {!livingOnCampus ? (
          <div className="mt-4 space-y-4">
            <OnCampusTimeSection
              title="Previous fall semester on-campus time"
              description="Enter the days and time ranges when you were typically on campus during your previous fall semester."
              value={previousFallTime}
              errors={previousFallErrors}
              onChange={updatePreviousFallTime}
            />
            <OnCampusTimeSection
              title="Previous spring semester on-campus time"
              description="Enter the days and time ranges when you were typically on campus during your previous spring semester."
              value={previousSpringTime}
              errors={previousSpringErrors}
              onChange={updatePreviousSpringTime}
            />
            <OnCampusTimeSection
              title="Future fall semester on-campus time"
              description="Enter the days and time ranges when you expect to be on campus during your future fall semester."
              value={futureFallTime}
              errors={futureFallErrors}
              onChange={updateFutureFallTime}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            Living on campus is set to <strong>Yes</strong>, so schedule input is skipped and the
            model assumes full-day campus presence.
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={!canAnalyze || isAnalyzing}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isAnalyzing ? "Analyzing..." : "Run local analysis"}
          </button>
          <p className="text-sm text-slate-600">
            {canAnalyze
              ? "All required fall inputs are ready."
              : "Fix the fall input issues below to enable analysis."}
          </p>
        </div>

        {!canAnalyze ? (
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {blockingRequirements.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </SectionCard>

      <SectionCard
        title="4) Fall Results"
        subtitle="Prediction output and plan recommendation dashboard for fall mode."
      >
        {result ? (
          <div className="space-y-5">
            <div className="grid gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                Meal transactions parsed: <strong>{result.stats.parsedMeals}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Previous fall time blocks:{" "}
                <strong>{result.stats.previousFallTimeBlocks}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Previous spring time blocks:{" "}
                <strong>{result.stats.previousSpringTimeBlocks}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Future fall time blocks:{" "}
                <strong>{result.stats.futureFallTimeBlocks}</strong>
              </div>
            </div>
            {result.stats.usedFullDayCampusAssumption ? (
              <p className="text-sm text-slate-600">
                Full-day campus presence was assumed because you live on campus.
              </p>
            ) : null}
            <ResultsDashboard result={result} />
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Add your meal CSV and required on-campus time inputs, then run analysis to view
            results.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
