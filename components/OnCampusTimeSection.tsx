"use client";

import { DAY_OPTIONS, TIME_OPTIONS, createEmptyTimeBlock } from "@/lib/on-campus-time";
import { OnCampusTimeBlock } from "@/types/domain";

interface OnCampusTimeSectionProps {
  title: string;
  description: string;
  value: OnCampusTimeBlock[];
  errors: string[];
  onChange: (nextValue: OnCampusTimeBlock[]) => void;
}

export function OnCampusTimeSection({
  title,
  description,
  value,
  errors,
  onChange,
}: OnCampusTimeSectionProps) {
  function updateBlock(
    blockId: string,
    field: keyof Pick<OnCampusTimeBlock, "day" | "start" | "end">,
    fieldValue: string,
  ) {
    onChange(
      value.map((block) =>
        block.id === blockId ? { ...block, [field]: fieldValue } : block,
      ),
    );
  }

  function addBlock() {
    onChange([...value, createEmptyTimeBlock()]);
  }

  function removeBlock(blockId: string) {
    onChange(value.filter((block) => block.id !== blockId));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      <div className="space-y-3">
        {value.map((block, index) => (
          <div
            key={block.id}
            className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1.3fr_1fr_1fr_auto]"
          >
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Day
              </span>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                value={block.day}
                onChange={(event) => updateBlock(block.id, "day", event.target.value)}
              >
                {DAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Start time
              </span>
              <select
                value={block.start}
                onChange={(event) => updateBlock(block.id, "start", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Select start</option>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                End time
              </span>
              <select
                value={block.end}
                onChange={(event) => updateBlock(block.id, "end", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Select end</option>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => removeBlock(block.id)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                aria-label={`Remove time block ${index + 1}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {value.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No time blocks added yet.</p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={addBlock}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Add time block
        </button>
        <p className="text-sm text-slate-600">
          Add as many time ranges as needed, including multiple ranges on the same day, in
          10-minute increments.
        </p>
      </div>

      {errors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-amber-800">
          {errors.map((error) => (
            <li key={error}>- {error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
