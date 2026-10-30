"use client";

export interface PinRed {
  ime: string;
  fullName: string;
  pin: string;
  sumarija?: string;
}

/** PIN-ovi se prikazuju samo jednom; "Štampaj" ispisuje samo ovu tabelu */
export function PinSpisak({ redovi, naslov, onZatvori, toast }: {
  redovi: readonly PinRed[];
  naslov: string;
  onZatvori: () => void;
  toast: (m: string) => void;
}) {
  async function kopiraj() {
    const tekst = redovi.map((r) => [r.ime, r.fullName, r.pin].join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tekst);
      toast("Spisak kopiran ✓");
    } catch {
      toast("Greška: kopiranje nije dozvoljeno u ovom pregledniku.");
    }
  }

  return (
    <section className="pin-spisak rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 text-amber-900 dark:text-amber-200 space-y-3">
      <style>{`@media print {
        body * { visibility: hidden; }
        .pin-spisak, .pin-spisak * { visibility: visible; }
        .pin-spisak { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; border: 0; }
        .pin-spisak .ne-stampaj { display: none !important; }
      }`}</style>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{naslov}</h3>
        <div className="ne-stampaj ml-auto flex flex-wrap gap-2">
          <button onClick={kopiraj} className="rounded-lg border border-amber-400 dark:border-amber-700 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900">Kopiraj</button>
          <button onClick={() => window.print()} className="rounded-lg border border-amber-400 dark:border-amber-700 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900">Štampaj</button>
          <button onClick={onZatvori} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">Zapisao sam</button>
        </div>
      </div>
      <p className="ne-stampaj text-xs opacity-80">Zapiši i javi PIN-ove korisnicima — nakon zatvaranja se više ne prikazuju (novi PIN se dobija preko „Reset PIN“).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide opacity-70">
              <th className="py-1 pr-4 font-semibold">Korisničko ime</th>
              <th className="py-1 pr-4 font-semibold">Ime i prezime</th>
              {redovi.some((r) => r.sumarija) && <th className="py-1 pr-4 font-semibold">Šumarija</th>}
              <th className="py-1 font-semibold">PIN</th>
            </tr>
          </thead>
          <tbody>
            {redovi.map((r) => (
              <tr key={r.ime} className="border-t border-amber-200 dark:border-amber-900">
                <td className="py-1.5 pr-4 font-mono font-semibold">{r.ime}</td>
                <td className="py-1.5 pr-4">{r.fullName}</td>
                {redovi.some((x) => x.sumarija) && <td className="py-1.5 pr-4">{r.sumarija}</td>}
                <td className="py-1.5 font-mono text-lg font-bold tracking-[0.25em]">{r.pin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
