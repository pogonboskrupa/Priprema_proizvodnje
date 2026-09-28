/** Prošli mjesec od 1. do istog dana kao danas (kraće ako prošli mjesec nema taj dan) */
export function prosliMjesecDoDanas(now = new Date()): { od: Date; do_: Date; doDana: number } {
  const od = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const zadnjiDan = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const doDana = Math.min(now.getDate(), zadnjiDan);
  return { od, do_: new Date(od.getFullYear(), od.getMonth(), doDana, 23, 59, 59, 999), doDana };
}

export type Period = "sedmicno" | "mjesecno" | "godisnje";

/** Referentni datum perioda neposredno prije onog u kojem je `ref` */
export function prethodniRef(period: Period, ref: Date): Date {
  if (period === "sedmicno") return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 7);
  if (period === "mjesecno") return new Date(ref.getFullYear(), ref.getMonth() - 1, 15);
  return new Date(ref.getFullYear() - 1, 6, 1);
}

export const NAZIV_PRETHODNOG: Record<Period, string> = {
  sedmicno: "prethodnu sedmicu",
  mjesecno: "prethodni mjesec",
  godisnje: "prethodnu godinu",
};
