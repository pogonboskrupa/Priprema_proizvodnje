"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getKorisnici, getKorisnik, createKorisnik, updateKorisnik, deleteKorisnik } from "@/lib/db";
import { saveSession, isRemembered } from "@/lib/auth";
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
    const k = await getKorisnici();
    setKorisnici(k);
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
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Postavke</h1>

      {msg && (
        <div className="mb-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg px-4 py-2 text-sm">
          {msg}
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
                  Dodaj (PIN: 1234)
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
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {korisnici.map((k) => {
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
                    <td className="px-4 py-3 text-right">
                      {k.role === "worker" && (
                        <button
                          onClick={async () => {
                            await updateKorisnik(k.id, { operater: !k.operater });
                            loadKorisnici();
                          }}
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
                        <button onClick={() => handleDelete(k)} className="text-red-500 dark:text-red-400 hover:underline text-xs">
                          Obriši
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
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
