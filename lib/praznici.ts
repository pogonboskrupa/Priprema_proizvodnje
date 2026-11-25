// Neradni praznici: državni (fiksni datumi) i bajrami (promjenjivi datumi, prvi dan).
const PRAZNICI: Record<string, string> = {
  "01-01": "Nova godina",
  "01-02": "Nova godina",
  "03-01": "Dan nezavisnosti",
  "05-01": "Praznik rada",
  "05-02": "Praznik rada",
  "11-25": "Dan državnosti",
};

// Bajrami se pomjeraju oko 11 dana godišnje, pa se upisuju po datumu (prvi dan bajrama).
// Datumi su astronomski proračun i mogu odstupiti za dan od odluke Rijaseta Islamske zajednice u BiH — provjeri ih
// svake godine i po potrebi ispravi (npr. dodaj i drugi dan bajrama kao novi red).
const RAMAZANSKI = "Ramazanski bajram";
const KURBAN = "Kurban-bajram";
const BAJRAMI: Record<string, string> = {
  "2026-03-20": RAMAZANSKI, "2026-05-27": KURBAN,
  "2027-03-09": RAMAZANSKI, "2027-05-16": KURBAN,
  "2028-02-26": RAMAZANSKI, "2028-05-05": KURBAN,
  "2029-02-14": RAMAZANSKI, "2029-04-24": KURBAN,
  "2030-02-04": RAMAZANSKI, "2030-04-13": KURBAN,
};

/** "2026-05-01" → "Praznik rada" | null */
export function praznik(datum: string): string | null {
  return BAJRAMI[datum.slice(0, 10)] ?? PRAZNICI[datum.slice(5, 10)] ?? null;
}

function weekday(datum: string): number {
  const [y, m, d] = datum.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export const jeNedjelja = (datum: string) => weekday(datum) === 0;
export const jeVikend = (datum: string) => [0, 6].includes(weekday(datum));

/** Ponedjeljak–petak, osim praznika — samo ti dani se troše iz godišnjeg odmora */
export function jeRadniDan(datum: string): boolean {
  const w = weekday(datum);
  return w !== 0 && w !== 6 && !praznik(datum);
}
