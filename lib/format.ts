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

/** "2026-09-15" → "ponedjeljak, 15. august" */
export function fmtDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString("bs-BA", { weekday: "long" });
  return `${weekday}, ${d}. ${MONTHS_BS[m - 1]}`;
}
