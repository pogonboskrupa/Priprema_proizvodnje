/** "Amir Hodžić" → "AMIR.HODZIC"; jedna riječ ostaje jedna riječ */
export function predloziKorisnickoIme(punoIme: string): string {
  const bezDiakritika = punoIme
    .trim()
    .replace(/đ/g, "dj").replace(/Đ/g, "Dj")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  const rijeci = bezDiakritika.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, "")).filter(Boolean);
  if (!rijeci.length) return "";
  const ime = rijeci.length === 1 ? rijeci[0] : `${rijeci[0]}.${rijeci[rijeci.length - 1]}`;
  return ime.toUpperCase().slice(0, 30);
}

/** Ako je osnova zauzeta, dodaje broj (AMIR.HODZIC2, AMIR.HODZIC3…) */
export function jedinstvenoIme(osnova: string, zauzeta: ReadonlySet<string>): string {
  if (!osnova || !zauzeta.has(osnova)) return osnova;
  for (let n = 2; n < 100; n++) {
    const kandidat = `${osnova.slice(0, 30 - String(n).length)}${n}`;
    if (!zauzeta.has(kandidat)) return kandidat;
  }
  return osnova;
}
