import { parseMealHistory } from "@/lib/parsing/meal-history";
import { parseTabularFile } from "@/lib/parsing/tabular";
import { ClassYear } from "@/types/domain";

export type UploadStatus = "empty" | "selected" | "validating" | "valid" | "invalid";

export interface UploadSlotState {
  file: File | null;
  fileName: string;
  fileSizeBytes: number;
  status: UploadStatus;
  message: string;
}

export const CLASS_YEAR_OPTIONS: { label: string; value: ClassYear }[] = [
  { label: "First-year", value: "first-year" },
  { label: "Sophomore", value: "sophomore" },
  { label: "Junior", value: "junior" },
  { label: "Senior", value: "senior" },
  { label: "Graduate", value: "graduate" },
  { label: "Other upper-class", value: "other-upper-class" },
];

export function emptyUploadSlotState(): UploadSlotState {
  return {
    file: null,
    fileName: "",
    fileSizeBytes: 0,
    status: "empty",
    message: "No file selected.",
  };
}

export function validatingUploadSlotState(file: File): UploadSlotState {
  return {
    file,
    fileName: file.name,
    fileSizeBytes: file.size,
    status: "validating",
    message: "File selected. Validating...",
  };
}

export async function validateMealHistoryFile(file: File | null): Promise<UploadSlotState> {
  if (!file) {
    return emptyUploadSlotState();
  }

  try {
    const rows = await parseTabularFile(file);
    if (rows.length === 0) {
      throw new Error("File parsed but contained no rows.");
    }

    const parsed = parseMealHistory(rows);
    if (parsed.length < 8) {
      throw new Error("Meal history needs at least 8 valid transactions for analysis.");
    }

    return {
      file,
      fileName: file.name,
      fileSizeBytes: file.size,
      status: "valid",
      message: `Parsed successfully (${parsed.length} transactions).`,
    };
  } catch (error) {
    return {
      file,
      fileName: file.name,
      fileSizeBytes: file.size,
      status: "invalid",
      message: error instanceof Error ? error.message : "Invalid meal history file.",
    };
  }
}
