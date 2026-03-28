import { DayOfWeek, OnCampusTimeBlock, ScheduleFeatures } from "@/types/domain";

export const DAYS_PER_WEEK = 7;

export const DAY_OPTIONS: { label: string; value: DayOfWeek; weekday: number }[] = [
  { label: "Monday", value: "monday", weekday: 1 },
  { label: "Tuesday", value: "tuesday", weekday: 2 },
  { label: "Wednesday", value: "wednesday", weekday: 3 },
  { label: "Thursday", value: "thursday", weekday: 4 },
  { label: "Friday", value: "friday", weekday: 5 },
  { label: "Saturday", value: "saturday", weekday: 6 },
  { label: "Sunday", value: "sunday", weekday: 0 },
];

export const TIME_OPTIONS: string[] = Array.from({ length: 24 * 6 }, (_, index) => {
  const totalMinutes = index * 10;
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
});

const DAY_TO_WEEKDAY = new Map(DAY_OPTIONS.map((option) => [option.value, option.weekday]));

function makeBlockId(): string {
  return `time-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseTime(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59 || minutes % 10 !== 0) return null;

  return hours * 60 + minutes;
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((left, right) => left[0] - right[0]);
  const merged: [number, number][] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];

    if (current[0] <= previous[1]) {
      previous[1] = Math.max(previous[1], current[1]);
      continue;
    }

    merged.push(current);
  }

  return merged;
}

export function createEmptyTimeBlock(day: DayOfWeek = "monday"): OnCampusTimeBlock {
  return {
    id: makeBlockId(),
    day,
    start: "",
    end: "",
  };
}

export function countCompletedTimeBlocks(blocks: OnCampusTimeBlock[]): number {
  return blocks.filter((block) => block.start.trim() !== "" && block.end.trim() !== "").length;
}

export function validateOnCampusTimeBlocks(
  blocks: OnCampusTimeBlock[],
  label: string,
): string[] {
  const errors: string[] = [];

  if (blocks.length === 0) {
    return [`${label}: add at least one time block.`];
  }

  let validBlockCount = 0;

  blocks.forEach((block, index) => {
    const rowLabel = `${label}: row ${index + 1}`;
    const hasStart = block.start.trim() !== "";
    const hasEnd = block.end.trim() !== "";

    if (!hasStart && !hasEnd) {
      errors.push(`${rowLabel} is empty. Fill it in or remove it.`);
      return;
    }

    if (!hasStart || !hasEnd) {
      errors.push(`${rowLabel} must include both a start and end time.`);
      return;
    }

    const startMinutes = parseTime(block.start);
    const endMinutes = parseTime(block.end);

    if (startMinutes === null || endMinutes === null) {
      errors.push(`${rowLabel} must use valid times.`);
      return;
    }

    if (startMinutes >= endMinutes) {
      errors.push(`${rowLabel} must have a start time before the end time.`);
      return;
    }

    validBlockCount += 1;
  });

  if (validBlockCount === 0) {
    errors.push(`${label}: add at least one valid time block.`);
  }

  return errors;
}

export function deriveScheduleFeaturesFromTimeBlocks(
  blocks: OnCampusTimeBlock[],
): ScheduleFeatures {
  const byDay = new Map<number, [number, number][]>();

  blocks.forEach((block) => {
    const weekday = DAY_TO_WEEKDAY.get(block.day);
    const startMinutes = parseTime(block.start);
    const endMinutes = parseTime(block.end);

    if (weekday === undefined || startMinutes === null || endMinutes === null) {
      return;
    }

    if (startMinutes >= endMinutes) {
      return;
    }

    const ranges = byDay.get(weekday) ?? [];
    ranges.push([startMinutes, endMinutes]);
    byDay.set(weekday, ranges);
  });

  let lunchPresenceDays = 0;
  let dinnerPresenceDays = 0;
  let eveningPresenceDays = 0;
  let totalMinutes = 0;
  let longestGapMinutes = 0;

  DAY_OPTIONS.forEach((day) => {
    const merged = mergeRanges(byDay.get(day.weekday) ?? []);
    if (merged.length === 0) {
      return;
    }

    const hasLunch = merged.some(([start, end]) => start < 14 * 60 + 30 && end > 11 * 60);
    const hasDinner = merged.some(
      ([start, end]) => start < 21 * 60 + 30 && end > 17 * 60 + 30,
    );
    const hasEvening = merged.some(([, end]) => end >= 18 * 60);

    if (hasLunch) lunchPresenceDays += 1;
    if (hasDinner) dinnerPresenceDays += 1;
    if (hasEvening) eveningPresenceDays += 1;

    totalMinutes += merged.reduce((sum, [start, end]) => sum + (end - start), 0);

    for (let index = 1; index < merged.length; index += 1) {
      longestGapMinutes += Math.max(0, merged[index][0] - merged[index - 1][1]);
    }
  });

  return {
    lunchPresenceDays,
    dinnerPresenceDays,
    avgLongestGapMinutes: longestGapMinutes / DAYS_PER_WEEK,
    avgTotalCampusMinutes: totalMinutes / DAYS_PER_WEEK,
    eveningPresenceDays,
  };
}

export function fullDayCampusFeatures(): ScheduleFeatures {
  return {
    lunchPresenceDays: DAYS_PER_WEEK,
    dinnerPresenceDays: DAYS_PER_WEEK,
    avgLongestGapMinutes: 0,
    avgTotalCampusMinutes: 14 * 60,
    eveningPresenceDays: DAYS_PER_WEEK,
  };
}
