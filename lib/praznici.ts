// Državni neradni praznici FBiH (fiksni datumi). Vjerski praznici važe samo za
// pripadnike vjere pa se ne tretiraju kao opšti neradni dani.
const PRAZNICI: Record<string, string> = {
  "01-01": "Nova godina",
  "01-02": "Nova godina",
  "03-01": "Dan nezavisnosti",
  "05-01": "Praznik rada",
  "05-02": "Praznik rada",
  "11-25": "Dan državnosti",
};

/** "2026-05-01" → "Praznik rada" | null */
export function praznik(datum: string): string | null {
  return PRAZNICI[datum.slice(5, 10)] ?? null;
}

function weekday(datum: string): number {
  const [y, m, d] = datum.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export const jeNedjelja = (datum: string) => weekday(datum) === 0;

/** Ponedjeljak–petak, osim praznika — samo ti dani se troše iz godišnjeg odmora */
export function jeRadniDan(datum: string): boolean {
  const w = weekday(datum);
  return w !== 0 && w !== 6 && !praznik(datum);
}
