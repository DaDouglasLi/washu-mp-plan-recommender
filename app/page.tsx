"use client";

import { useState } from "react";
import { FallModeForm } from "@/components/FallModeForm";
import { SectionCard } from "@/components/SectionCard";
import { SpringModeForm } from "@/components/SpringModeForm";
import { PredictionSemester } from "@/types/domain";

export default function Home() {
  const [mode, setMode] = useState<PredictionSemester>("spring");

  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4">
        <section className="rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-700 p-8 text-white shadow-md">
          <h1 className="text-3xl font-bold">
            WashU Meal Plan Optimizer (based on 2026-27 meal point policy)
          </h1>
          <p className="mt-2 max-w-3xl text-indigo-100">
            Predict your next-semester WashU Dining spending from local uploads, then choose the
            cheapest practical meal plan instead of overbuying points.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-indigo-100">
            Assumption: if a student starts living off campus, the model assumes they will not
            move back to a dorm later in the academic year.
          </p>
        </section>

        <SectionCard
          title="1) Choose Prediction Mode"
          subtitle="Spring and Fall are now separate forms with separate upload fields and separate state."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("spring")}
              className={`rounded-xl border p-5 text-left transition ${
                mode === "spring"
                  ? "border-indigo-600 bg-indigo-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-indigo-300"
              }`}
            >
              <p className="text-lg font-semibold text-slate-900">Spring mode</p>
              <p className="mt-2 text-sm text-slate-600">
                Requires a meal transactions CSV plus manual on-campus time only when the
                student does not live on campus.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("fall")}
              className={`rounded-xl border p-5 text-left transition ${
                mode === "fall"
                  ? "border-violet-600 bg-violet-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-violet-300"
              }`}
            >
              <p className="text-lg font-semibold text-slate-900">Fall mode</p>
              <p className="mt-2 text-sm text-slate-600">
                Requires a meal transactions CSV plus manual on-campus time only when the
                student does not live on campus.
              </p>
            </button>
          </div>
        </SectionCard>

        {mode === "spring" ? <SpringModeForm /> : <FallModeForm />}

        <SectionCard title="5) Methodology & Caveats">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>- Deterministic local heuristics classify spending into lunch/snack/dinner/misc categories.</li>
            <li>- Off-campus users enter manual on-campus time blocks instead of uploading schedules.</li>
            <li>- A modest shortfall is acceptable and often cheaper than buying a higher plan.</li>
            <li>- For spring, fall rollover is included; on-campus users use a full-day campus assumption.</li>
            <li>- “Suggested Balance” is intentionally ignored in recommendation logic.</li>
          </ul>
        </SectionCard>

        <SectionCard title="6) Privacy">
          <p className="text-sm text-slate-700">
            All processing runs locally in your browser. No login, no backend database, and no
            server-side storage. Uploaded files are not persisted; refreshing the page clears all
            loaded data.
          </p>
        </SectionCard>

        <SectionCard title="7) Support The Project">
          <p className="text-sm text-slate-700">
            If you found this useful, please give the project a star on{" "}
            <a
              href="https://github.com/DaDouglasLi/washu-mp-plan-recommender.git"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-indigo-700 underline underline-offset-2"
            >
              GitHub
            </a>
            .
          </p>
        </SectionCard>
      </div>
    </main>
  );
}
