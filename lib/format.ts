const MONTHS_BS = [
  "januar","februar","mart","april","maj","juni",
  "juli","august","septembar","oktobar","novembar","decembar",
];

/** "2026-09-15" → "15.09.2026." */
export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}.${m}.${y}.`;
}

/** "2026-09-15" → "15.09." */
export function fmtDateShort(dateStr: string): string {
  const [, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}.${m}.`;
}

/** month: 1-based → "august" */
export function monthName(month: number): string {
  return MONTHS_BS[month - 1] ?? "";
}

/** Date → "august 2026" */
export function mesecLabel(date: Date): string {
  return `${MONTHS_BS[date.getMonth()]} ${date.getFullYear()}`;
}

/** year, month (1-based) → "august 2026" */
export function monthYearLabel(year: number, month: number): string {
  return `${MONTHS_BS[month - 1]} ${year}`;
}

/** Lokalni datum "YYYY-MM-DD" (toISOString daje UTC — pogrešan dan između 00h i 02h) */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "12,5" | "12.5" → 12.5; prazno → null; neispravno ili negativno → NaN */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** Cijeli broj; "1.234" → 1234 (tačka/zarez = separator hiljada); prazno → null; neispravno → NaN */
export function parseCount(s: string): number | null {
  const t = s.trim().replace(/[\s.,]/g, "");
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

const DAYS_BS =["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"];

/** "2026-09-15" → "ponedjeljak, 15. august" */
export function fmtDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const weekday = DAYS_BS[new Date(y, m - 1, d).getDay()];
  return `${weekday}, ${d}. ${MONTHS_BS[m - 1]}`;
}
