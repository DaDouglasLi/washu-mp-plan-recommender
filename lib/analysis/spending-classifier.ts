import { DINING_WINDOWS } from "@/lib/meal-rules/constants";
import {
  CategorizedTransaction,
  ParsedMealTransaction,
  SpendCategory,
} from "@/types/domain";

function inferCategory(txn: ParsedMealTransaction): SpendCategory {
  const minuteOfDay = Math.round(txn.hour * 60);
  if (minuteOfDay < DINING_WINDOWS.breakfastEnd) return "breakfast";
  if (minuteOfDay < DINING_WINDOWS.lunchEnd) {
    if (txn.amount < 4.5) return "snack";
    return "lunch";
  }
  if (minuteOfDay < DINING_WINDOWS.snackEnd) {
    if (txn.amount < 6.5) return "snack";
    return "misc";
  }
  if (minuteOfDay < DINING_WINDOWS.dinnerEnd) {
    if (txn.amount < 5) return "snack";
    return "dinner";
  }
  if (minuteOfDay >= DINING_WINDOWS.dinnerEnd) return "late";
  return "misc";
}

export function categorizeTransactions(
  transactions: ParsedMealTransaction[],
): CategorizedTransaction[] {
  return transactions.map((txn) => ({
    ...txn,
    category: inferCategory(txn),
  }));
}
