"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getKorisnici, getKorisnik, createKorisnik, updateKorisnik, deleteKorisnik } from "@/lib/db";
import { saveSession, isRemembered } from "@/lib/auth";
import type { Korisnik } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";

// Postavi na true tek kad pravi APK fajl bude na public/app-release.apk
const APK_AVAILABLE = false;

const APK_VERSION = '1.0.0';
const APK_DATE = '22. 09. 2026.';
const APK_SIZE = '8.4 MB';
const APK_CHANGES = [
  'Novo: vrsta rada "Teren" za terenski boravak',
  'Izvještaji — radnici vide samo svoje podatke',
  'Poboljšan vizuelni kontrast i dark mode',
  'Brže učitavanje zahvaljujući Firestore cache-u',
];

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
    setKorisnici(await getKorisnici());
  }

  async function saveProfile() {
    if (!session) return;
    await updateKorisnik(session.userId, { fullName: profForm.fullName, title: profForm.title });
    saveSession({ ...session, fullName: profForm.fullName }, isRemembered());
    refresh();
    loadMe(session.userId);
    toast("Profil sačuvan ✓");
  }

  async function changePin() {
    if (!session || !me) return;
    if (pinForm.old !== me.pin) { setPinMsg("Trenutni PIN nije ispravan!"); return; }
    if (!/^\d{4}$/.test(pinForm.new1)) { setPinMsg("Novi PIN mora biti 4 cifre!"); return; }
    if (pinForm.new1 !== pinForm.new2) { setPinMsg("PIN-ovi se ne poklapaju!"); return; }
    await updateKorisnik(session.userId, { pin: pinForm.new1 });
    setPinForm({ old: "", new1: "", new2: "" });
    setMe({ ...me, pin: pinForm.new1 });
    setPinMsg("PIN promijenjen ✓");
    setTimeout(() => setPinMsg(""), 3000);
  }

  async function addKorisnik() {
    if (!addForm.ime.trim()) { toast("Upiši korisničko ime!"); return; }
    if (korisnici.some((k) => k.ime.toUpperCase() === addForm.ime.toUpperCase())) {
      toast("Korisnik s tim imenom već postoji!"); return;
    }
    await createKorisnik({
      ime: addForm.ime.toUpperCase(),
      fullName: addForm.fullName || addForm.ime,
      title: addForm.title,
      pin: "1234",
      role: "worker",
      avatar: "",
      odjeliIds: [],
    });
    setAddForm({ ime: "", fullName: "", title: "" });
    setShowAdd(false);
    loadKorisnici();
    toast(`Projektant ${addForm.ime.toUpperCase()} dodan — PIN: 1234 ✓`);
  }

  function resetPin(k: Korisnik) {
    setConfirmState({
      msg: `Resetovati PIN za ${k.ime} na 1234?`,
      okLabel: "Resetuj",
      okColor: "amber",
      onOk: async () => {
        setConfirmState(null);
        await updateKorisnik(k.id, { pin: "1234" });
        toast(`PIN za ${k.ime} resetovan na 1234 ✓`);
      },
    });
  }

  function handleDelete(k: Korisnik) {
    setConfirmState({
      msg: `Obrisati korisnika ${k.ime}? Ova akcija je nepovratna.`,
      onOk: async () => {
        setConfirmState(null);
        await deleteKorisnik(k.id);
        loadKorisnici();
      },
    });
  }

  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  if (loading || !session) return null;



  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Postavke</h1>

      {msg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profil */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Moj profil</h2>
          <div>
            <div className="text-xs text-gray-500 mb-1">Prijavljeni kao</div>
            <div className="font-bold text-gray-800 text-lg">{session.ime}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">{session.role}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Puno ime i prezime</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={profForm.fullName}
              onChange={(e) => setProfForm({ ...profForm, fullName: e.target.value })}
              maxLength={60}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Titula / radno mjesto</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
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
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Promjena PIN-a</h2>
          {["old", "new1", "new2"].map((f, i) => (
            <div key={f}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {i === 0 ? "Trenutni PIN" : i === 1 ? "Novi PIN (4 cifre)" : "Potvrdi novi PIN"}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="w-full border rounded-lg px-3 py-2 text-sm"
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

      {/* APK download */}
      <ApkDownload />

      {/* Admin: upravljanje korisnicima */}
      {session.role === "admin" && (
        <div className="mt-6 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="font-semibold text-gray-700">
              Korisnici <span className="text-xs font-normal text-gray-500">— upravljanje projektantima</span>
            </span>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-800"
            >
              + Novi projektant
            </button>
          </div>

          {showAdd && (
            <div className="p-4 border-b bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Korisničko ime (za prijavu)</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={addForm.ime}
                    onChange={(e) => setAddForm({ ...addForm, ime: e.target.value })}
                    maxLength={30}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Puno ime i prezime</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Radno mjesto</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    maxLength={60}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addKorisnik} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800">
                  Dodaj (PIN: 1234)
                </button>
                <button onClick={() => setShowAdd(false)} className="border px-4 py-2 rounded-lg text-sm text-gray-600">
                  Odustani
                </button>
              </div>
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Korisnik</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Puno ime</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Uloga</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {korisnici.map((k) => (
                <tr key={k.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium font-mono">{k.ime}</td>
                  <td className="px-4 py-3 text-gray-600">{k.fullName || "–"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      k.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {k.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => resetPin(k)} className="text-amber-600 hover:underline text-xs mr-3">
                      Reset PIN
                    </button>
                    {k.id !== session.userId && (
                      <button onClick={() => handleDelete(k)} className="text-red-500 hover:underline text-xs">
                        Obriši
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function ApkDownload() {
  const apkUrl = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/app-release.apk`;
  const [dlState, setDlState] = useState<"idle" | "progress" | "done">("idle");
  const [progress, setProgress] = useState(0);

  function handleDownload() {
    if (dlState !== "idle") return;
    setDlState("progress");
    setProgress(0);

    let p = 0;
    const tick = () => {
      p += Math.random() * 13 + 4;
      const clamped = Math.min(p, 100);
      setProgress(clamped);
      if (clamped >= 100) {
        const a = document.createElement("a");
        a.href = apkUrl;
        a.download = "PripremaProizvodnje.apk";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          setDlState("done");
          setTimeout(() => { setDlState("idle"); setProgress(0); }, 4000);
        }, 250);
        return;
      }
      setTimeout(tick, 55 + Math.random() * 65);
    };
    tick();
  }

  return (
    <div className="mt-6 bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
        <span className="text-base">📱</span>
        <span className="font-semibold text-gray-700">Android aplikacija</span>
        <span className="ml-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
          v{APK_VERSION} · Novo
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex gap-4 items-start">
          {/* App icon */}
          <div
            className="flex-shrink-0 w-[68px] h-[68px] rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)" }}
          >
            <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5S11 23.33 11 22.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zm-2.5-10C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84 1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0 0 12 1.5c-.69 0-1.35.12-1.96.33L8.56.35c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3A5.978 5.978 0 0 0 6 7h12a5.978 5.978 0 0 0-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
            </svg>
          </div>

          {/* Meta */}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-800 text-lg leading-tight">Priprema Proizvodnje</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-gray-400"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                v{APK_VERSION}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-gray-400"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                {APK_SIZE}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-gray-400"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
                {APK_DATE}
              </span>
            </div>

            {/* Changelog */}
            <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">🆕</span>
                <span className="text-xs font-semibold text-green-800">Šta je novo</span>
              </div>
              <ul className="space-y-1.5">
                {APK_CHANGES.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-green-900">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-green-600 flex-shrink-0 mt-0.5">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Download button */}
        <div className="mt-5 space-y-2.5">
          {!APK_AVAILABLE ? (
            <div className="w-full rounded-xl h-12 flex items-center justify-center gap-2 bg-gray-100 border border-gray-200 text-gray-400 text-sm font-medium cursor-not-allowed select-none">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
              </svg>
              APK uskoro dostupan
            </div>
          ) : (
            <button
              onClick={handleDownload}
              disabled={dlState !== "idle"}
              className="relative w-full rounded-xl h-12 overflow-hidden font-semibold text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-shadow"
              style={{
                backgroundColor:
                  dlState === "done" ? "#14532d" : dlState === "progress" ? "#15803d" : "#166534",
                boxShadow:
                  dlState === "idle"
                    ? "0 4px 14px 0 rgba(22, 101, 52, 0.4)"
                    : "none",
              }}
            >
              {/* Animated progress fill */}
              {dlState === "progress" && (
                <div
                  className="absolute inset-y-0 left-0 bg-green-950 transition-[width] duration-75"
                  style={{ width: `${progress}%` }}
                />
              )}

              {/* Shimmer when idle */}
              {dlState === "idle" && (
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background:
                      "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.6) 50%, transparent 60%)",
                    animation: "shimmer 2.5s infinite",
                  }}
                />
              )}

              <span className="relative z-10 flex items-center justify-center gap-2">
                {dlState === "idle" && (
                  <>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                    Preuzmi APK &nbsp;·&nbsp; Android
                  </>
                )}
                {dlState === "progress" && (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 fill-current"
                      style={{ animation: "spin 1s linear infinite" }}
                    >
                      <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z" />
                    </svg>
                    Priprema preuzimanja&nbsp; {Math.round(progress)}%
                  </>
                )}
                {dlState === "done" && (
                  <>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                    Preuzimanje počelo!
                  </>
                )}
              </span>
            </button>
          )}

          {/* Install note */}
          <div className="flex gap-2 items-start rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-amber-500 flex-shrink-0 mt-0.5">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              APK nije dostupan u Google Play-u. Prije instalacije idite na{" "}
              <strong>Postavke → Aplikacije → Instaliraj nepoznate aplikacije</strong> i omogućite
              instalaciju iz preglednika ili file managera.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
