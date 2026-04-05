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
          subtitle="If you are going to deside your plan for fall semester, choose fall mode; if you are going to deside your plan for spring semester, choose spring mode."
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
            <li>- Meal transactions are used to measure your real spending pattern: how often you buy lunch, snacks, and dinner, how much you usually spend, and how that changes week to week.</li>
            <li>- On-campus time inputs are used to estimate when you are likely to need food on campus. Lunch-time presence, evening presence, and long daytime gaps all affect predicted future demand.</li>
            <li>- In spring mode, the model uses your previous fall behavior to estimate next spring. In fall mode, it uses your previous fall and current spring behavior together to estimate next fall.</li>
            <li>- If you lived on campus during a semester, the model assumes full-day campus presence for that semester, so schedule input is not required.</li>
            <li>- The recommendation compares eligible meal plans against predicted spending, rollover rules, likely leftover waste, and reasonable out-of-pocket shortfall to find the cheapest practical option.</li>
            <li>- Results are directional estimates, not guarantees. Unusual habits, travel, guests, or major routine changes can make actual spending differ.</li>
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
