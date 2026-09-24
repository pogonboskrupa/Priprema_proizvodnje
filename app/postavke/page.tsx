"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getKorisnici, getKorisnik, getKorisnikByIme, createKorisnik, updateKorisnik, arhivirajKorisnika } from "@/lib/db";
import { saveSession, isRemembered, generatePin } from "@/lib/auth";
import type { Korisnik } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";


export default function PostavkePage() {
  const { session, loading, refresh } = useAuth();
  const router = useRouter();
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [me, setMe] = useState<Korisnik | null>(null);
  const [profForm, setProfForm] = useState({ fullName: "", title: "" });
  const [pinForm, setPinForm] = useState({ old: "", new1: "", new2: "" });
  const [addForm, setAddForm] = useState({ ime: "", fullName: "", title: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [msg, setMsg] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [pinNotice, setPinNotice] = useState<{ ime: string; pin: string; novi: boolean } | null>(null);
  const [showArhiva, setShowArhiva] = useState(false);
  const [confirmState, setConfirmState] = useState<{ msg: string; okLabel?: string; okColor?: "red" | "amber"; onOk: () => void } | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [session, loading]);

  useEffect(() => {
    if (!session) return;
    loadMe(session.userId);
    if (session.role === "admin") loadKorisnici();
  }, [session]);

  async function loadMe(id: string) {
    const k = await getKorisnik(id);
    if (!k) return;
    setMe(k);
    setProfForm({ fullName: k.fullName || "", title: k.title || "" });
  }

  async function loadKorisnici() {
    const k = await getKorisnici({ ukljuciArhivirane: true });
    setKorisnici(k);
  }

  async function guarded(action: () => Promise<void>) {
    try { await action(); } catch { toast("Greška pri snimanju. Provjeri internet i pokušaj ponovo."); }
  }

  const saveProfile = () => guarded(async () => {
    if (!session) return;
    await updateKorisnik(session.userId, { fullName: profForm.fullName, title: profForm.title });
    saveSession({ ...session, fullName: profForm.fullName }, isRemembered());
    refresh();
    loadMe(session.userId);
    toast("Profil sačuvan ✓");
  });

  async function changePin() {
    if (!session || !me) return;
    if (!/^\d{4}$/.test(pinForm.new1)) { setPinMsg("Novi PIN mora biti 4 cifre!"); return; }
    if (pinForm.new1 !== pinForm.new2) { setPinMsg("PIN-ovi se ne poklapaju!"); return; }
    try {
      // svjež PIN sa servera — admin ga je možda resetovao na drugom uređaju
      const fresh = await getKorisnikByIme(me.ime);
      if (pinForm.old !== (fresh?.pin ?? me.pin)) { setPinMsg("Trenutni PIN nije ispravan!"); return; }
      await updateKorisnik(session.userId, { pin: pinForm.new1 });
    } catch {
      setPinMsg("Greška pri snimanju PIN-a.");
      return;
    }
    setPinForm({ old: "", new1: "", new2: "" });
    setMe({ ...me, pin: pinForm.new1 });
    setPinMsg("PIN promijenjen ✓");
    setTimeout(() => setPinMsg(""), 3000);
  }

  const addKorisnik = () => guarded(async () => {
    const ime = addForm.ime.trim().toUpperCase();
    if (!ime) { toast("Upiši korisničko ime!"); return; }
    if (korisnici.some((k) => k.ime.toUpperCase() === ime)) {
      toast("Korisnik s tim imenom već postoji (možda u arhivi)!"); return;
    }
    const pin = generatePin();
    await createKorisnik({
      ime,
      fullName: addForm.fullName || addForm.ime,
      title: addForm.title,
      pin,
      role: "worker",
      avatar: "",
      odjeliIds: [],
    });
    setAddForm({ ime: "", fullName: "", title: "" });
    setShowAdd(false);
    loadKorisnici();
    setPinNotice({ ime, pin, novi: true });
  });

  function resetPin(k: Korisnik) {
    setConfirmState({
      msg: `Resetovati PIN za ${k.ime}? Dobiće novi nasumični PIN koji ćeš mu javiti.`,
      okLabel: "Resetuj",
      okColor: "amber",
      onOk: () => guarded(async () => {
        setConfirmState(null);
        const pin = generatePin();
        await updateKorisnik(k.id, { pin });
        setPinNotice({ ime: k.ime, pin, novi: false });
      }),
    });
  }

  function handleArhiviraj(k: Korisnik) {
    setConfirmState({
      msg: `Arhivirati korisnika ${k.ime}? Neće se moći prijaviti niti se pojavljivati u unosima; njegova rješenja se oslobađaju. Unosi i izvještaji ostaju sačuvani.`,
      okLabel: "Arhiviraj",
      okColor: "amber",
      onOk: () => guarded(async () => {
        setConfirmState(null);
        await arhivirajKorisnika(k, true);
        loadKorisnici();
      }),
    });
  }

  const vratiIzArhive = (k: Korisnik) => guarded(async () => {
    await arhivirajKorisnika(k, false);
    loadKorisnici();
  });

  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  function fmtLastLogin(iso: string | undefined): string {
    if (!iso) return "–";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    if (diffMin < 1) return "Upravo";
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffH < 24) return `Danas ${d.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })}`;
    if (diffD === 1) return `Jučer ${d.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })}`;
    if (diffD < 7) return `${diffD} dana ago`;
    return d.toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  if (loading || !session) return null;



  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Postavke</h1>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm border ${
          msg.startsWith("Greška")
            ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
            : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
        }`}>
          {msg}
        </div>
      )}

      {pinNotice && (
        <div className="mb-4 rounded-lg px-4 py-3 border bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-4 flex-wrap">
          <div className="text-sm">
            {pinNotice.novi ? "Projektant" : "Novi PIN za"} <b className="font-mono">{pinNotice.ime}</b>{pinNotice.novi ? " dodan. PIN:" : ":"}
            <span className="ml-2 font-mono text-2xl font-bold tracking-[0.3em] align-middle">{pinNotice.pin}</span>
            <div className="text-xs mt-1 opacity-80">Zapiši i javi PIN korisniku — nakon zatvaranja više se ne prikazuje.</div>
          </div>
          <button
            onClick={() => setPinNotice(null)}
            className="ml-auto bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            Zapisao sam
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profil */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Moj profil</h2>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Prijavljeni kao</div>
            <div className="font-bold text-gray-800 dark:text-gray-100 text-lg">{session.ime}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Puno ime i prezime</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={profForm.fullName}
              onChange={(e) => setProfForm({ ...profForm, fullName: e.target.value })}
              maxLength={60}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Titula / radno mjesto</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={profForm.title}
              onChange={(e) => setProfForm({ ...profForm, title: e.target.value })}
              maxLength={60}
            />
          </div>
          <button
            onClick={saveProfile}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
          >
            Sačuvaj profil
          </button>
        </div>

        {/* PIN */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Promjena PIN-a</h2>
          {["old", "new1", "new2"].map((f, i) => (
            <div key={f}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                {i === 0 ? "Trenutni PIN" : i === 1 ? "Novi PIN (4 cifre)" : "Potvrdi novi PIN"}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={pinForm[f as "old" | "new1" | "new2"]}
                onChange={(e) => setPinForm({ ...pinForm, [f]: e.target.value })}
                placeholder="••••"
              />
            </div>
          ))}
          {pinMsg && (
            <div className={`text-sm ${pinMsg.includes("✓") ? "text-green-600" : "text-red-600"}`}>
              {pinMsg}
            </div>
          )}
          <button
            onClick={changePin}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
          >
            Sačuvaj PIN
          </button>
        </div>
      </div>

      {/* Admin: upravljanje korisnicima */}
      {session.role === "admin" && (
        <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              Korisnici <span className="text-xs font-normal text-gray-500 dark:text-gray-400">— upravljanje projektantima</span>
            </span>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-800"
            >
              + Novi projektant
            </button>
          </div>

          {showAdd && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Korisničko ime (za prijavu)</label>
                  <input
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={addForm.ime}
                    onChange={(e) => setAddForm({ ...addForm, ime: e.target.value })}
                    maxLength={30}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Puno ime i prezime</label>
                  <input
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Radno mjesto</label>
                  <input
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    maxLength={60}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addKorisnik} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800">
                  Dodaj
                </button>
                <button onClick={() => setShowAdd(false)} className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  Odustani
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Korisnik</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Puno ime</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Uloga</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Zadnja prijava</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {korisnici.filter((k) => !k.arhiviran).map((k) => {
                return (
                  <tr key={k.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium font-mono">{k.ime}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{k.fullName || "–"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        k.role === "admin" ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}>
                        {k.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {fmtLastLogin(k.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {k.role === "worker" && (
                        <button
                          onClick={() => guarded(async () => {
                            await updateKorisnik(k.id, { operater: !k.operater });
                            loadKorisnici();
                          })}
                          className={`text-xs mr-3 px-2 py-0.5 rounded-full font-medium border transition-colors ${
                            k.operater
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800"
                              : "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                          title={k.operater ? "Ukloni operaterska prava" : "Dodaj operaterska prava"}
                        >
                          Operater
                        </button>
                      )}
                      <button onClick={() => resetPin(k)} className="text-amber-600 dark:text-amber-400 hover:underline text-xs mr-3">
                        Reset PIN
                      </button>
                      {k.id !== session.userId && (
                        <button onClick={() => handleArhiviraj(k)} className="text-amber-600 dark:text-amber-400 hover:underline text-xs">
                          Arhiviraj
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {korisnici.some((k) => k.arhiviran) && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3">
              <button
                onClick={() => setShowArhiva((v) => !v)}
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:underline"
              >
                {showArhiva ? "▾" : "▸"} Arhiva ({korisnici.filter((k) => k.arhiviran).length})
              </button>
              {showArhiva && (
                <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                  {korisnici.filter((k) => k.arhiviran).map((k) => (
                    <div key={k.id} className="py-2 flex items-center gap-3 text-sm">
                      <span className="font-mono text-gray-500 dark:text-gray-400">{k.ime}</span>
                      <span className="text-gray-400 dark:text-gray-500">{k.fullName}</span>
                      <button onClick={() => vratiIzArhive(k)} className="ml-auto text-xs text-green-700 dark:text-green-400 hover:underline">
                        Vrati
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {confirmState && (
        <ConfirmModal
          msg={confirmState.msg}
          okLabel={confirmState.okLabel}
          okColor={confirmState.okColor}
          onOk={confirmState.onOk}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
