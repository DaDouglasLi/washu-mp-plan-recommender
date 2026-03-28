import { ParsedMealTransaction } from "@/types/domain";
import { GenericRow } from "./tabular";

const DATE_CANDIDATES = ["date", "transaction date", "posted date"];
const TIME_CANDIDATES = ["time", "transaction time"];
const DATETIME_CANDIDATES = ["datetime", "transaction datetime", "timestamp"];
const AMOUNT_CANDIDATES = [
  "amount",
  "points",
  "points spent",
  "debit",
  "transaction amount",
];
const MERCHANT_CANDIDATES = [
  "merchant",
  "location",
  "description",
  "vendor",
  "detail",
];

const ON_CAMPUS_POSITIVE_MARKERS = [
  "bear's den",
  "bd",
  "duff",
  "ibby's",
  "south 40",
  "danforth university center",
  "duc",
  "whispers",
  "parkside",
  "village",
  "washu",
];

const ON_CAMPUS_NEGATIVE_MARKERS = [
  "bauer",
  "knight hall",
  "business school cafe",
  "school of medicine",
  "medical school",
  "parking",
  "vending",
];

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[_-]+/g, " ").trim();
}

function getByHeaderCandidates(
  row: GenericRow,
  candidates: string[],
): string | number | null | undefined {
  const entries = Object.entries(row).map(([key, value]) => [
    normalizeHeader(key),
    value,
  ]) as [string, string | number | null | undefined][];

  for (const candidate of candidates) {
    const match = entries.find(([normalized]) =>
      normalized.includes(candidate),
    );
    if (match) return match[1];
  }
  return undefined;
}

function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Math.abs(raw);

  const num = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return null;
  return Math.abs(num);
}

function parseDateTime(
  dateRaw: string | number | null | undefined,
  timeRaw: string | number | null | undefined,
  datetimeRaw: string | number | null | undefined,
): Date | null {
  if (datetimeRaw) {
    const dt = new Date(String(datetimeRaw));
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  if (!dateRaw) return null;
  const combined = `${String(dateRaw)} ${timeRaw ? String(timeRaw) : ""}`.trim();
  const parsed = new Date(combined);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(String(dateRaw));
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function confidenceForMerchant(
  merchant: string,
): ParsedMealTransaction["onCampusConfidence"] {
  const m = merchant.toLowerCase();
  if (ON_CAMPUS_NEGATIVE_MARKERS.some((token) => m.includes(token))) {
    return "low";
  }
  if (ON_CAMPUS_POSITIVE_MARKERS.some((token) => m.includes(token))) {
    return "high";
  }
  return "medium";
}

export function parseMealHistory(rows: GenericRow[]): ParsedMealTransaction[] {
  const transactions: ParsedMealTransaction[] = [];

  rows.forEach((row, idx) => {
    const dateRaw = getByHeaderCandidates(row, DATE_CANDIDATES);
    const timeRaw = getByHeaderCandidates(row, TIME_CANDIDATES);
    const datetimeRaw = getByHeaderCandidates(row, DATETIME_CANDIDATES);
    const amountRaw = getByHeaderCandidates(row, AMOUNT_CANDIDATES);
    const merchantRaw = getByHeaderCandidates(row, MERCHANT_CANDIDATES);

    const date = parseDateTime(dateRaw, timeRaw, datetimeRaw);
    const amount = parseAmount(amountRaw);
    const merchant = String(merchantRaw ?? "Unknown").trim();

    if (!date || amount === null || amount <= 0) return;
    if (date.getFullYear() < 2020 || date.getFullYear() > 2030) return;
    if (amount > 100) return;

    transactions.push({
      id: `txn-${idx}-${date.getTime()}`,
      date,
      weekday: date.getDay(),
      hour: date.getHours() + date.getMinutes() / 60,
      amount,
      merchant,
      rawDescription: JSON.stringify(row),
      onCampusConfidence: confidenceForMerchant(merchant),
    });
  });

  return transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
}
