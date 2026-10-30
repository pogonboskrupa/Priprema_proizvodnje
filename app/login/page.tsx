"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getKorisnikByIme, updateKorisnik } from "@/lib/db";
import { saveSession, getSession } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { VERSION } from "@/lib/version";

const DUZINA_PINA = 4;
const CIFRE = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const tipka =
  "h-14 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xl font-semibold text-gray-800 dark:text-gray-100 " +
  "shadow-sm transition active:scale-95 hover:bg-green-50 hover:border-green-600/50 dark:hover:bg-green-950/40 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 disabled:opacity-40 disabled:pointer-events-none select-none";

// Nema <form> ni polja za lozinku: PIN se unosi tipkovnicom ili klikom, pa preglednik ne nudi spremanje lozinke
export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [ime, setIme] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [errTick, setErrTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(false);
  const imeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (getSession()) { router.replace("/"); return; }
    // na računaru odmah piši ime; na telefonu fokus bi otvorio sistemsku tipkovnicu preko brojeva
    if (window.matchMedia("(pointer: fine)").matches) imeRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function greska(poruka: string) {
    setErr(poruka);
    setErrTick((t) => t + 1);
    setPin("");
  }

  function addDigit(d: string) {
    if (pin.length >= DUZINA_PINA || submitting) return;
    const next = pin + d;
    setPin(next);
    setErr("");
    if (next.length === DUZINA_PINA) setTimeout(() => doLogin(next), 80);
  }

  function delDigit() { setPin((p) => p.slice(0, -1)); setErr(""); }
  function clearPin() { setPin(""); setErr(""); }

  async function doLogin(p: string = pin) {
    const nameTrimmed = ime.trim().toUpperCase();
    if (!nameTrimmed) { greska("Unesi korisničko ime!"); imeRef.current?.focus(); return; }
    if (p.length < DUZINA_PINA) { setErr("Unesi 4-cifreni PIN!"); return; }
    setSubmitting(true);
    try {
      const found = await getKorisnikByIme(nameTrimmed);
      setSubmitting(false);
      if (!found) { greska("Korisnik nije pronađen!"); return; }
      if (found.arhiviran) { greska("Korisnički račun je arhiviran."); return; }
      if (p !== String(found.pin ?? "")) { greska("Pogrešan PIN!"); return; }
      const loginAt = new Date().toISOString();
      try {
        await Promise.race([
          updateKorisnik(found.id, { lastLoginAt: loginAt }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
        ]);
      } catch {
        // best-effort write — continue login regardless
      }
      saveSession(
        { userId: found.id, ime: found.ime, fullName: found.fullName, role: found.role, operater: found.operater ?? false, sihter: found.sihter ?? false, izvjestaji: found.izvjestaji ?? false, sumarijaId: found.sumarijaId, avatar: found.avatar },
        remember
      );
      refresh();
      router.replace("/");
    } catch {
      setSubmitting(false);
      greska("Greška pri prijavi. Provjeri internet ili Firebase postavke.");
    }
  }

  // Tipkovnica: cifre i Backspace idu u PIN, Enter iz polja za ime prelazi na PIN, Esc briše PIN
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || submitting) return;
      const uImenu = e.target === imeRef.current;
      if (e.key === "Enter") {
        if (uImenu) { if (ime.trim()) imeRef.current?.blur(); }
        else if (e.target === document.body && pin.length === DUZINA_PINA) doLogin();
        return;
      }
      if (uImenu) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); addDigit(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); delDigit(); }
      else if (e.key === "Escape") clearPin();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tockice = Array.from({ length: DUZINA_PINA }, (_, i) => submitting || pin.length > i);

  return (
    // preko cijelog ekrana: layout inače ostavlja razmak oko sadržaja
    <div className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-gradient-to-br from-green-700 via-green-800 to-green-950">
      <div aria-hidden className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none fixed -left-32 bottom-0 h-80 w-80 rounded-full bg-white/5" />

      <div className="relative flex min-h-full items-center justify-center p-4">
      <main className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 p-6 sm:p-7 shadow-2xl ring-1 ring-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img
          src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icons/logo.png`}
          alt=""
          width={80}
          height={80}
          className="mx-auto mb-3 h-20 w-20 rounded-full shadow-lg ring-4 ring-green-100 dark:ring-green-950"
        />
        <h1 className="text-center text-xl font-bold tracking-tight text-green-800 dark:text-green-400">Priprema Proizvodnje</h1>
        <p className="mt-1 mb-5 text-center text-xs text-gray-500 dark:text-gray-400">ŠPD Unsko-sanske šume · Sekcija pripreme proizvodnje</p>

        <div className="mb-5">
          <label htmlFor="login-ime" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Korisničko ime</label>
          <input
            id="login-ime"
            ref={imeRef}
            name="pp-ime"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            placeholder="Upiši ime…"
            value={ime}
            onChange={(e) => { setIme(e.target.value); setErr(""); setPin(""); }}
            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5 text-base font-bold uppercase tracking-wider text-gray-900 dark:text-gray-50 placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/30"
          />
        </div>

        <div className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">PIN</div>
        <div key={errTick} className={`mt-2 flex justify-center gap-3.5 ${err ? "pp-shake" : ""}`} aria-label={`Uneseno ${pin.length} od ${DUZINA_PINA} cifara`} role="img">
          {tockice.map((on, i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
              err ? "border-red-600 bg-red-600"
              : submitting ? "border-gray-400 bg-gray-400"
              : on ? "border-green-700 bg-green-700 dark:border-green-400 dark:bg-green-400 scale-110"
              : "border-gray-300 dark:border-gray-600"
            }`} />
          ))}
        </div>
        <div role="alert" aria-live="polite" className="mb-2 mt-2 min-h-[1.25rem] text-center text-sm font-medium text-red-600 dark:text-red-400">
          {submitting ? <span className="font-normal text-gray-500 dark:text-gray-400">Prijava…</span> : err}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {CIFRE.map((d) => (
            <button key={d} type="button" onClick={() => addDigit(d)} disabled={submitting} aria-label={`Cifra ${d}`} className={tipka}>{d}</button>
          ))}
          <button type="button" onClick={clearPin} disabled={submitting || pin.length === 0} aria-label="Obriši cijeli PIN" className={`${tipka} !text-sm !font-medium !text-gray-500 dark:!text-gray-400`}>Očisti</button>
          <button type="button" onClick={() => addDigit("0")} disabled={submitting} aria-label="Cifra 0" className={tipka}>0</button>
          <button type="button" onClick={delDigit} disabled={submitting || pin.length === 0} aria-label="Obriši zadnju cifru" className={`${tipka} !text-lg !text-gray-500 dark:!text-gray-400`}>⌫</button>
        </div>

        <p className="mt-3 text-center text-[11px] text-gray-400 dark:text-gray-500">
          Klikni brojeve ili kucaj PIN na tastaturi · Enter nakon imena prelazi na PIN
        </p>

        <label className="mt-4 flex cursor-pointer select-none items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-green-700" />
          Ostani prijavljen na ovom uređaju
        </label>

        <div className="mt-5 text-center text-[11px] tracking-wider text-gray-400 dark:text-gray-500">v{VERSION}</div>
      </main>
      </div>
    </div>
  );
}
