"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getKorisnici, getKorisnik, createKorisnik, updateKorisnik, deleteKorisnik } from "@/lib/db";
import { saveSession, isRemembered } from "@/lib/auth";
import type { Korisnik } from "@/lib/types";

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

  async function resetPin(k: Korisnik) {
    if (!confirm(`Resetovati PIN za ${k.ime} na 1234?`)) return;
    await updateKorisnik(k.id, { pin: "1234" });
    toast(`PIN za ${k.ime} resetovan na 1234 ✓`);
  }

  async function handleDelete(k: Korisnik) {
    if (!confirm(`Obrisati korisnika ${k.ime}?`)) return;
    await deleteKorisnik(k.id);
    loadKorisnici();
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
        <div className="bg-white rounded-xl border p-5 space-y-4">
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
        <div className="bg-white rounded-xl border p-5 space-y-4">
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

      {/* Admin: upravljanje korisnicima */}
      {session.role === "admin" && (
        <div className="mt-6 bg-white rounded-xl border overflow-hidden">
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
    </div>
  );
}
