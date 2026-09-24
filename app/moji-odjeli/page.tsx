"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMojiOdjeliData, getKorisnik, getKorisnici, updateKorisnik, preuzmiRjesenje, otpustiRjesenje } from "@/lib/db";
import type { Korisnik, Odjel } from "@/lib/types";
import { odjelZaGodinu } from "@/lib/plan-sjece";

const tekucaGodina = new Date().getFullYear();

const ELABORAT_URL = "https://pogonboskrupa.github.io/Pregled_po_odsjecima/";

interface OdjelStats {
  ha: number;
  stabala: number;
  km: number;
}

export default function MojiOdjeliPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [me, setMe] = useState<Korisnik | null>(null);
  const [allOdjeli, setAllOdjeli] = useState<Odjel[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [statsPerOdjel, setStatsPerOdjel] = useState<Record<string, OdjelStats>>({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [addOdjelId, setAddOdjelId] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !session) { router.replace("/login/"); return; }
    if (!loading && session?.role !== "worker") { router.replace("/"); return; }
  }, [session, loading]);

  useEffect(() => {
    if (!session || session.role !== "worker") return;
    Promise.all([
      getMojiOdjeliData(),
      getKorisnik(session.userId),
    ]).then(([data, meData]) => {
      setAllOdjeli(data.odjeli.filter((o) => !o.arhiviran));
      setKorisnici(data.korisnici);
      setStatsPerOdjel(data.statsPerOdjel);
      if (meData) {
        setMe(meData);
      }
      setDataLoaded(true);
    }).catch(() => {
      setMsg("Greška pri učitavanju. Provjeri internet i osvježi stranicu.");
      setDataLoaded(true);
    });
  }, [session]);

  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  // odjelId → korisnikId koji ima rješenje; moj red uzima iz `me` jer je korisnici lista stara nakon izmjene
  const rjesenjeOwner: Record<string, string> = {};
  for (const k of korisnici) {
    const ids = me && k.id === me.id ? me.odjeliRjesenjaIds : k.odjeliRjesenjaIds;
    for (const odjelId of ids ?? []) rjesenjeOwner[odjelId] = k.id;
  }

  async function saveMe(patch: Partial<Pick<Korisnik, "odjeliIds">>, okMsg: string) {
    if (!me || !session) return;
    const previousIds = me.odjeliIds;
    // funkcionalni update: removeOdjel prije ovoga mijenja rješenja u istom toku
    setMe((m) => m && { ...m, ...patch });
    setSaving(true);
    try {
      await updateKorisnik(session.userId, patch);
      toast(okMsg);
    } catch {
      setMe((m) => m && { ...m, odjeliIds: previousIds });
      toast("Greška pri snimanju — promjena nije sačuvana.");
    } finally {
      setSaving(false);
    }
  }

  async function addOdjel() {
    if (!addOdjelId || !me) return;
    const current = me.odjeliIds ?? [];
    setAddOdjelId("");
    if (current.includes(addOdjelId)) return;
    await saveMe({ odjeliIds: [...current, addOdjelId] }, "Odjel dodan ✓");
  }

  async function removeOdjel(odjelId: string) {
    if (!me || !session) return;
    if ((me.odjeliRjesenjaIds ?? []).includes(odjelId)) {
      const released = await toggleRjesenje(odjelId, true);
      if (!released) return;
    }
    await saveMe({ odjeliIds: (me.odjeliIds ?? []).filter((id) => id !== odjelId) }, "Odjel uklonjen ✓");
  }

  // Vraća true ako je promjena uspjela
  async function toggleRjesenje(odjelId: string, release: boolean): Promise<boolean> {
    if (!me || !session) return false;
    setSaving(true);
    try {
      if (release) {
        await otpustiRjesenje(session.userId, odjelId);
      } else {
        const res = await preuzmiRjesenje(session.userId, odjelId);
        if (!res.ok) {
          const fresh = await getKorisnici().catch(() => korisnici);
          setKorisnici(fresh);
          const owner = fresh.find((k) => k.id === res.ownerId);
          toast(`Greška: rješenje za ovaj odjel već ima ${owner?.fullName || owner?.ime || "drugi projektant"}.`);
          return false;
        }
      }
      setMe((m) => {
        if (!m) return m;
        const rjesenja = (m.odjeliRjesenjaIds ?? []).filter((id) => id !== odjelId);
        return { ...m, odjeliRjesenjaIds: release ? rjesenja : [...rjesenja, odjelId] };
      });
      toast(release ? "Rješenje uklonjeno ✓" : "Rješenje preuzeto ✓");
      return true;
    } catch {
      toast("Greška: za rješenje je potrebna internet veza. Pokušaj ponovo.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function claimRjesenje(odjelId: string) {
    if (!me) return;
    const existingOwner = rjesenjeOwner[odjelId];
    if (existingOwner && existingOwner !== me.id) return;
    await toggleRjesenje(odjelId, (me.odjeliRjesenjaIds ?? []).includes(odjelId));
  }

  if (loading || !session || !dataLoaded) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 dark:text-gray-500 text-sm">
        Učitavanje...
      </div>
    );
  }

  const myOdjeliIds = me?.odjeliIds ?? [];
  const myRjesenjaIds = me?.odjeliRjesenjaIds ?? [];
  const myOdjeli = allOdjeli.filter((o) => myOdjeliIds.includes(o.id));
  const availableToAdd = allOdjeli.filter((o) => !myOdjeliIds.includes(o.id));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">Moji odjeli</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Odjeli u kojima radiš. Zvjezdica = rješenje o izradi projekta (samo jedan projektant po odjelu).
      </p>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm border ${
          msg.startsWith("Greška")
            ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
            : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
        }`}>
          {msg}
        </div>
      )}

      {/* Add odjel */}
      <div className="mb-6 flex gap-2 max-w-lg">
        <select
          value={addOdjelId}
          onChange={(e) => setAddOdjelId(e.target.value)}
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">— Dodaj odjel u listu —</option>
          {availableToAdd.map((o) => (
            <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
          ))}
        </select>
        <button
          onClick={addOdjel}
          disabled={!addOdjelId || saving}
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-40"
        >
          + Dodaj
        </button>
      </div>

      {/* Odjeli list */}
      {myOdjeli.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <p className="text-3xl mb-3">🌲</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nisi dodao/la nijedan odjel.</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Odaberi odjel iz padajuće liste gore.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myOdjeli.map((odjel) => {
            const hasRjesenje = myRjesenjaIds.includes(odjel.id);
            const owner = rjesenjeOwner[odjel.id];
            const takenByOther = owner && owner !== me?.id;
            const ownerKorisnik = takenByOther ? korisnici.find((k) => k.id === owner) : null;
            const stats = statsPerOdjel[odjel.id] ?? { ha: 0, stabala: 0, km: 0 };
            const { plan_cet: planCet, plan_lis: planLis } = odjelZaGodinu(odjel, tekucaGodina);
            const povrsina = Number(odjel.povrsina) || 0;
            const postotak = povrsina > 0 ? Math.min(100, Math.round((stats.ha / povrsina) * 100)) : 0;

            return (
              <div
                key={odjel.id}
                className={`bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden ${
                  hasRjesenje
                    ? "border-amber-300 dark:border-amber-700"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {/* Header */}
                <div className={`px-5 py-3 flex items-center justify-between ${
                  hasRjesenje
                    ? "bg-amber-50 dark:bg-amber-950/40"
                    : "bg-gray-50 dark:bg-gray-800"
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <span className="font-bold text-gray-800 dark:text-gray-100">
                        {odjel.gj} / {odjel.broj}
                      </span>
                      {povrsina > 0 && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {povrsina} ha
                        </span>
                      )}
                    </div>
                    {hasRjesenje && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                        ★ Rješenje
                      </span>
                    )}
                    {takenByOther && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">
                        Rješenje: {ownerKorisnik?.fullName || ownerKorisnik?.ime || "drugi projektant"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {/* Claim rješenje button */}
                    <button
                      onClick={() => claimRjesenje(odjel.id)}
                      disabled={saving || (!!takenByOther)}
                      title={
                        takenByOther
                          ? "Drugi projektant ima rješenje za ovaj odjel"
                          : hasRjesenje
                          ? "Ukloni rješenje"
                          : "Preuzmi rješenje"
                      }
                      className={`text-xl leading-none transition-colors disabled:cursor-not-allowed ${
                        takenByOther
                          ? "text-gray-200 dark:text-gray-700"
                          : hasRjesenje
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-gray-300 dark:text-gray-600 hover:text-amber-400"
                      }`}
                    >
                      {hasRjesenje ? "★" : "☆"}
                    </button>

                    {/* Elaborat link */}
                    <a
                      href={ELABORAT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Otvori elaborat"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      Elaborat ↗
                    </a>

                    {/* Remove */}
                    <button
                      onClick={() => removeOdjel(odjel.id)}
                      disabled={saving}
                      title="Ukloni iz mojih odjela"
                      className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 text-sm transition-colors disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Stats — show for all workers in their odjeli, full detail for rješenje holder */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <StatTile label="Stabala" value={stats.stabala.toLocaleString("bs")} unit="kom" />
                    <StatTile label="Doznaka" value={stats.ha.toFixed(2)} unit="ha" />
                    <StatTile label="Vlake" value={stats.km.toFixed(2)} unit="km" />
                    {hasRjesenje && (
                      <StatTile
                        label="Plan ha"
                        value={povrsina > 0 ? `${postotak}%` : "—"}
                        unit={povrsina > 0 ? `od ${povrsina} ha` : ""}
                        highlight={postotak >= 90}
                      />
                    )}
                  </div>

                  {/* Progress bar — ha doznačeno vs. povrsina */}
                  {povrsina > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Doznaka ha</span>
                        <span>{stats.ha.toFixed(2)} / {povrsina} ha</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            postotak >= 90 ? "bg-green-500" : postotak >= 50 ? "bg-amber-400" : "bg-blue-400"
                          }`}
                          style={{ width: `${postotak}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Plan četinari/lišćari — rješenje holder only */}
                  {hasRjesenje && (planCet > 0 || planLis > 0) && (
                    <div className="mt-3 flex gap-4">
                      {planCet > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Plan četinara {tekucaGodina}: <span className="font-semibold text-gray-700 dark:text-gray-200">{planCet.toLocaleString("bs")} m³</span>
                        </div>
                      )}
                      {planLis > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Plan lišćara {tekucaGodina}: <span className="font-semibold text-gray-700 dark:text-gray-200">{planLis.toLocaleString("bs")} m³</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${highlight ? "bg-green-50 dark:bg-green-950/40" : "bg-gray-50 dark:bg-gray-800"}`}>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>
      <div className={`font-bold text-lg leading-tight tabular-nums ${highlight ? "text-green-700 dark:text-green-300" : "text-gray-800 dark:text-gray-100"}`}>
        {value}
      </div>
      {unit && <div className="text-xs text-gray-400 dark:text-gray-500">{unit}</div>}
    </div>
  );
}
