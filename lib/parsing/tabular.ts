import Papa from "papaparse";

export type GenericRow = Record<string, string | number | null | undefined>;

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";
}

export async function parseTabularFile(file: File): Promise<GenericRow[]> {
  const extension = getFileExtension(file.name);

  if (extension === ".csv") {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });
    if (parsed.errors.length > 0) {
      throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
    }

    return parsed.data.map((row) => {
      const normalized: GenericRow = {};
      Object.entries(row).forEach(([key, value]) => {
        normalized[key] = value?.trim() ?? null;
      });
      return normalized;
    });
  }

  throw new Error("Unsupported file type. Please upload a CSV file.");
}
