"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { VERSION } from "@/lib/version";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const REPO = "pogonboskrupa/Priprema_proizvodnje";
const APK_NAME = "priprema-proizvodnje.apk";
// Fiksno ime fajla na zadnjem GitHub Release-u (pravi ga .github/workflows/build-apk.yml)
const APK_FALLBACK_URL = `https://github.com/${REPO}/releases/latest/download/${APK_NAME}`;

type Provjera =
  | { stanje: "provjera" }
  | { stanje: "najnovija" }
  | { stanje: "nova"; verzija: string }
  | { stanje: "greska" };

interface ApkInfo { verzija: string; datum: string; url: string }

/** true ako je a novija od b (npr. "1.5.152" > "1.5.151") */
function jeNovija(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

async function dohvatiVerziju(): Promise<string> {
  const res = await fetch(`${BASE}/version.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("version.json");
  const { version } = (await res.json()) as { version?: string };
  if (!version) throw new Error("version");
  return version;
}

async function dohvatiApk(): Promise<ApkInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!res.ok) return null;
  const r = (await res.json()) as { tag_name?: string; published_at?: string; assets?: { name: string; browser_download_url: string }[] };
  const asset = r.assets?.find((a) => a.name === APK_NAME);
  if (!asset || !r.tag_name) return null;
  const d = r.published_at ? new Date(r.published_at) : null;
  return {
    verzija: r.tag_name.replace(/^v/, ""),
    datum: d ? `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}.` : "",
    url: asset.browser_download_url,
  };
}

/** Briše keš i service worker pa učitava aplikaciju iznova, da se povuče najnovija verzija */
async function azurirajAplikaciju() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const kljucevi = await caches.keys();
    await Promise.all(kljucevi.map((k) => caches.delete(k)));
  } catch { /* ako brisanje keša ne uspije, običan reload i dalje radi */ }
  window.location.reload();
}

const dugme = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2";

/** Verzija, ažuriranje i preuzimanje APK-a — vide svi korisnici */
export function AplikacijaKartica() {
  const [provjera, setProvjera] = useState<Provjera>({ stanje: "provjera" });
  const [apk, setApk] = useState<ApkInfo | null>(null);
  const [ponovi, setPonovi] = useState(0);

  useEffect(() => {
    let otkazano = false;
    dohvatiVerziju()
      .then((v) => { if (!otkazano) setProvjera(jeNovija(v, VERSION) ? { stanje: "nova", verzija: v } : { stanje: "najnovija" }); })
      .catch(() => { if (!otkazano) setProvjera({ stanje: "greska" }); });
    return () => { otkazano = true; };
  }, [ponovi]);

  useEffect(() => {
    let otkazano = false;
    dohvatiApk().then((a) => { if (!otkazano) setApk(a); }).catch(() => {});
    return () => { otkazano = true; };
  }, []);

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">
          <Icon name="download" className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Aplikacija</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Instalirana verzija <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">v{VERSION}</span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Ažuriranje</h3>
        {provjera.stanje === "provjera" && <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Provjera nove verzije…</p>}
        {provjera.stanje === "najnovija" && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">✓ Imaš najnoviju verziju.</p>
        )}
        {provjera.stanje === "greska" && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-400">Provjera nije uspjela — provjeri internet i pokušaj ponovo.</p>
        )}
        {provjera.stanje === "nova" && (
          <p role="status" className="rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Dostupna je nova verzija <span className="font-mono font-semibold">v{provjera.verzija}</span>.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {provjera.stanje === "nova" && (
            <button onClick={azurirajAplikaciju} className={`${dugme} bg-green-700 text-white hover:bg-green-800`}>Ažuriraj sada</button>
          )}
          <button onClick={() => { setProvjera({ stanje: "provjera" }); setPonovi((n) => n + 1); }} disabled={provjera.stanje === "provjera"}
            className={`${dugme} border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50`}>
            Provjeri ažuriranje
          </button>
          {provjera.stanje !== "nova" && (
            <button onClick={azurirajAplikaciju} className="text-sm text-gray-500 dark:text-gray-400 hover:underline px-2">
              Osvježi aplikaciju
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Aplikacija i APK uvijek učitavaju najnoviju verziju s interneta; ažuriranje samo briše staru kopiju s uređaja.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Android aplikacija (APK)</h3>
          {apk && (
            <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">
              Zadnji APK <span className="font-mono font-semibold">v{apk.verzija}</span>{apk.datum && <span className="text-gray-500 dark:text-gray-400"> · {apk.datum}</span>}
            </p>
          )}
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Preuzmi i otvori na telefonu; dozvoli instalaciju iz nepoznatih izvora.
          </p>
        </div>
        <a href={apk?.url ?? APK_FALLBACK_URL} target="_blank" rel="noopener noreferrer" className={`${dugme} bg-green-700 text-white hover:bg-green-800`}>
          <Icon name="download" className="h-4 w-4" />
          Preuzmi APK
        </a>
      </div>
    </section>
  );
}
