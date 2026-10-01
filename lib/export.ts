import writeXlsxFile, { type SheetData } from "write-excel-file/browser";

function cellValue(value: unknown): string | number | boolean {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value == null) return "";
  return String(value);
}

export async function exportXlsx(data: Record<string, unknown>[], filename: string): Promise<void> {
  const columns = [...new Set(data.flatMap((row) => Object.keys(row)))];
  const sheet: SheetData = [
    columns.map((value) => ({ value, type: String, fontWeight: "bold" as const })),
    ...data.map((row) => columns.map((key) => {
      const value = cellValue(row[key]);
      return { value, type: typeof value === "number" ? Number : typeof value === "boolean" ? Boolean : String };
    })),
  ];

  await writeXlsxFile(sheet, { sheet: "Podaci" }).toFile(`${filename}.xlsx`);
}
