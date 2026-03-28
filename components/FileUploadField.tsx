"use client";

import { ChangeEvent } from "react";

interface FileUploadFieldProps {
  label: string;
  description: string;
  accept?: string;
  required?: boolean;
  onFileSelect: (file: File | null) => void;
  fileName?: string;
  fileSizeBytes?: number;
  status: "empty" | "selected" | "validating" | "valid" | "invalid";
  statusMessage: string;
}

export function FileUploadField({
  label,
  description,
  accept = ".csv",
  required = false,
  onFileSelect,
  fileName,
  fileSizeBytes,
  status,
  statusMessage,
}: FileUploadFieldProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onFileSelect(file);
  }

  return (
    <label className="block rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-medium text-slate-900">{label}</span>
        {required ? (
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
            required
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-sm text-slate-600">{description}</p>
      <input
        className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-500"
        type="file"
        accept={accept}
        onChange={handleChange}
      />
      <p className="mt-2 text-sm text-slate-700">
        {fileName ? `Selected: ${fileName}` : "No file selected"}
        {fileSizeBytes ? ` (${(fileSizeBytes / 1024).toFixed(1)} KB)` : ""}
      </p>
      <p
        className={`mt-1 text-sm ${
          status === "invalid"
            ? "text-red-700"
            : status === "valid"
              ? "text-emerald-700"
              : "text-slate-600"
        }`}
      >
        {statusMessage}
      </p>
    </label>
  );
}
