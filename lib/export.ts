import * as XLSX from 'xlsx';

export function exportXlsx(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Podaci');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Preuzimanje fajla napravljenog u browseru (npr. Word izvještaj) */
export function preuzmiFajl(blob: Blob, imeFajla: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = imeFajla;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
