import {
  getAll,
  getAllFresh,
  getById,
  create,
  update,
  remove,
  queryCol,
  queryColFresh,
  queryColCache,
  unosiScope,
  Timestamp,
  where,
  orderBy,
  db,
  doc,
  authReady,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from './firebase';
import type { Odjel, OdjelGodina, Inzinjer, UnosRada, UnosRadaForm, Korisnik } from './types';
import { localDateStr, cmpOdjel } from './format';

// ── Unosi: normalizacija ID-a projektanta ────────────────────────────────────
// Stariji unosi su vezani za inzinjeri.id; svi ekrani filtriraju po korisnik.id,
// pa se ID ovdje svodi na korisnika (baza se ne mijenja).
async function queryUnosi(constraints: Parameters<typeof queryCol>[1]) {
  const scope = await unosiScope();
  const raw = scope.kind === 'own'
    // projektant: samo vlastiti unosi, iz cache-a koji puni sync listener
    // (serverski upit "in + datum" bi tražio composite index)
    ? await queryColCache('unosi', [where('inzinjerId', 'in', scope.ids), ...constraints])
    : await queryCol('unosi', constraints);
  return normalizujProjektante(raw);
}

async function normalizujProjektante(raw: Record<string, unknown>[]) {
  const inzinjeri = await getAll('inzinjeri');
  const owner = new Map<string, string>();
  for (const i of inzinjeri) if (i.korisnikId) owner.set(i.id as string, i.korisnikId as string);
  if (!owner.size) return raw;
  return raw.map((u) => {
    const k = owner.get(u.inzinjerId as string);
    return k ? { ...u, inzinjerId: k } : u;
  });
}

// ── Korisnici ─────────────────────────────────────────────────────────────────

export async function getKorisnici(opts: { ukljuciArhivirane?: boolean } = {}): Promise<Korisnik[]> {
  const raw = await getAllFresh('users');
  return (raw as unknown as Korisnik[])
    .filter((k) => opts.ukljuciArhivirane || !k.arhiviran)
    .sort((a, b) => a.ime.localeCompare(b.ime));
}

// Arhivirani projektant ostaje u izvještajima samo za periode u kojima ima unose
function isReportWorker(k: Korisnik, hasData: boolean): boolean {
  return k.role === 'worker' && (!k.arhiviran || hasData);
}

export async function getKorisnik(id: string): Promise<Korisnik | null> {
  const raw = await getById('users', id);
  return raw ? (raw as unknown as Korisnik) : null;
}

export async function getKorisnikByIme(ime: string): Promise<Korisnik | null> {
  const all = await queryColFresh('users', [where('ime', '==', ime.toUpperCase())]);
  return all.length ? all[0] as unknown as Korisnik : null;
}

export async function createKorisnik(data: Omit<Korisnik, 'id' | 'createdAt' | 'updatedAt'>): Promise<Korisnik> {
  const raw = await create('users', data as unknown as Record<string, unknown>);
  return raw as unknown as Korisnik;
}

export async function updateKorisnik(id: string, data: Partial<Omit<Korisnik, 'id' | 'createdAt'>>): Promise<Korisnik> {
  const raw = await update('users', id, data as Record<string, unknown>);
  return raw as unknown as Korisnik;
}

export async function arhivirajKorisnika(k: Korisnik, arhiviran: boolean): Promise<void> {
  if (arhiviran) {
    // oslobodi rješenja da ih drugi projektant može preuzeti
    for (const odjelId of k.odjeliRjesenjaIds ?? []) await otpustiRjesenje(k.id, odjelId);
  }
  await update('users', k.id, { arhiviran });
}

// ── Rješenja (jedan projektant po odjelu) ─────────────────────────────────────
// Lock dokument rjesenja/{odjelId} se upisuje u transakciji, pa dva istovremena
// preuzimanja ne mogu oba proći. Stariji vlasnici postoje samo u users.odjeliRjesenjaIds.

export type RjesenjeResult = { ok: true } | { ok: false; ownerId: string };

export async function preuzmiRjesenje(korisnikId: string, odjelId: string): Promise<RjesenjeResult> {
  await authReady();
  const users = await getAllFresh('users');
  const legacyOwner = users.find(
    (u) => u.id !== korisnikId && ((u.odjeliRjesenjaIds as string[] | undefined) ?? []).includes(odjelId)
  );
  const lockRef = doc(db, 'rjesenja', odjelId);

  return runTransaction(db, async (tx): Promise<RjesenjeResult> => {
    const lock = await tx.get(lockRef);
    const owner = lock.exists() ? (lock.data().korisnikId as string) : (legacyOwner?.id as string | undefined);
    if (owner && owner !== korisnikId) return { ok: false, ownerId: owner };
    tx.set(lockRef, { korisnikId, odjelId, createdAt: Timestamp.now() });
    tx.update(doc(db, 'users', korisnikId), { odjeliRjesenjaIds: arrayUnion(odjelId), updatedAt: Timestamp.now() });
    return { ok: true };
  });
}

export async function otpustiRjesenje(korisnikId: string, odjelId: string): Promise<void> {
  await authReady();
  const lockRef = doc(db, 'rjesenja', odjelId);
  await runTransaction(db, async (tx) => {
    const lock = await tx.get(lockRef);
    if (lock.exists() && lock.data().korisnikId === korisnikId) tx.delete(lockRef);
    tx.update(doc(db, 'users', korisnikId), { odjeliRjesenjaIds: arrayRemove(odjelId), updatedAt: Timestamp.now() });
  });
}

// ── Odjeli ────────────────────────────────────────────────────────────────────

export async function getOdjeli(opts: { ukljuciArhivirane?: boolean; saBrojem?: boolean } = {}): Promise<Odjel[]> {
  // brojanje prolazi kroz sve unose — samo stranica Odjeli ga traži
  const [odjeliRaw, inzinjeriRaw, unosiRaw] = await Promise.all([
    getAll('odjeli'),
    opts.saBrojem ? getAll('inzinjeri') : Promise.resolve([]),
    opts.saBrojem ? queryUnosi([]) : Promise.resolve([]),
  ]);
  const unosiPoOdjelu = new Map<string, number>();
  for (const u of unosiRaw) unosiPoOdjelu.set(u.odjelId as string, (unosiPoOdjelu.get(u.odjelId as string) ?? 0) + 1);

  return odjeliRaw
    .filter((o) => opts.ukljuciArhivirane || !o.arhiviran)
    .map((o) => ({
      ...(o as unknown as Odjel),
      ...(opts.saBrojem && {
        _count: {
          inzinjeri: inzinjeriRaw.filter((i) => i.odjelId === o.id).length,
          unosi: unosiPoOdjelu.get(o.id as string) ?? 0,
        },
      }),
    }))
    .sort(cmpOdjel);
}

export async function createOdjel(data: {
  gj: string;
  broj: string;
  povrsina: number;
}): Promise<Odjel> {
  const raw = await create('odjeli', data as Record<string, unknown>);
  return raw as unknown as Odjel;
}

export async function updateOdjel(
  id: string,
  data: { gj?: string; broj?: string; povrsina?: number; doznaceno?: boolean; vlakeProjektovane?: boolean }
): Promise<Odjel> {
  const raw = await update('odjeli', id, data as Record<string, unknown>);
  return raw as unknown as Odjel;
}

export async function updateOdjelGodina(id: string, year: number, povrsina: number, g: OdjelGodina): Promise<void> {
  // dotted path mijenja samo tu godinu; prošle godine ostaju kao arhiva
  await update('odjeli', id, { povrsina, [`poGodini.${year}`]: g });
}

export async function arhivirajOdjel(id: string, arhiviran: boolean): Promise<void> {
  await update('odjeli', id, { arhiviran });
}

// ── Inžinjeri ─────────────────────────────────────────────────────────────────

export async function getInzinjeriByKorisnikId(korisnikId: string): Promise<Inzinjer[]> {
  const [inzinjeriRaw, odjeliRaw] = await Promise.all([
    queryCol('inzinjeri', [where('korisnikId', '==', korisnikId)]),
    getAll('odjeli'),
  ]);
  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
  return inzinjeriRaw.map((i) => ({
    ...(i as unknown as Inzinjer),
    odjel: odMap[i.odjelId as string] as unknown as Odjel,
  }));
}

export interface PlanProjektantRed {
  korisnikId: string;
  ime: string;
  odjeli: string[];
  planHa: number;
  odradjeno: number;
  odradjenoKm: number;
  arhiviran: boolean;
}

// Plan se čuva po godini u users.planHaPoGodini; stari plan (inzinjeri.planHa, bez godine) je fallback
export async function getGodisnjePlanPoProjektantu(year: number): Promise<PlanProjektantRed[]> {
  const od = new Date(year, 0, 1);
  const do_ = new Date(year, 11, 31, 23, 59, 59, 999);

  const [unosiRaw, usersRaw, inzinjeriRaw, odjeliRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAllFresh('users'),
    getAll('inzinjeri'),
    getAll('odjeli'),
  ]);

  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o as unknown as Odjel]));
  const inzinjeri = inzinjeriRaw as unknown as Inzinjer[];

  const acc = new Map<string, { ha: number; km: number; odjeli: Set<string> }>();
  for (const u of unosiRaw) {
    const id = u.inzinjerId as string;
    const a = acc.get(id) ?? { ha: 0, km: 0, odjeli: new Set<string>() };
    if (u.vrsta === 'DOZNAKA') a.ha += Number(u.hektari) || 0;
    else if (u.vrsta === 'VLAKA') a.km += Number(u.kilometri) || 0;
    if ((u.vrsta === 'DOZNAKA' || u.vrsta === 'VLAKA') && u.odjelId) a.odjeli.add(u.odjelId as string);
    acc.set(id, a);
  }

  return (usersRaw as unknown as Korisnik[])
    .filter((k) => isReportWorker(k, acc.has(k.id)))
    .map((k) => {
      const a = acc.get(k.id);
      const legacyPlan = inzinjeri
        .filter((i) => i.korisnikId === k.id)
        .reduce((s, i) => s + (Number(i.planHa) || 0), 0);
      const planZaGodinu = k.planHaPoGodini?.[String(year)];
      return {
        korisnikId: k.id,
        ime: k.fullName || k.ime,
        odjeli: [...(a?.odjeli ?? [])]
          .map((id) => odMap[id] ? `${odMap[id].gj}/${odMap[id].broj}` : '')
          .filter(Boolean)
          .sort(),
        planHa: planZaGodinu ?? legacyPlan,
        odradjeno: a?.ha ?? 0,
        odradjenoKm: a?.km ?? 0,
        arhiviran: !!k.arhiviran,
      };
    })
    .sort((a, b) => a.ime.localeCompare(b.ime));
}

export async function setPlanHa(korisnikId: string, year: number, planHa: number): Promise<void> {
  // dotted path mijenja samo tu godinu, ostale ostaju
  await update('users', korisnikId, { [`planHaPoGodini.${year}`]: planHa });
}

// ── Unosi ─────────────────────────────────────────────────────────────────────

export async function getUnosi(): Promise<UnosRada[]> {
  const [unosiRaw, inzinjeriRaw, odjeliRaw, korisnaciRaw] = await Promise.all([
    queryUnosi( [orderBy('datum', 'desc')]),
    getAll('inzinjeri'),
    getAll('odjeli'),
    getAll('users'),
  ]);

  const inzMap = Object.fromEntries(inzinjeriRaw.map((i) => [i.id as string, i]));
  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
  const korMap = Object.fromEntries(korisnaciRaw.map((k) => [k.id as string, k]));

  return unosiRaw.map((u) => ({
    ...(u as unknown as UnosRada),
    inzinjer: inzMap[u.inzinjerId as string] as unknown as Inzinjer,
    korisnik: korMap[u.inzinjerId as string] as unknown as Korisnik,
    creator: korMap[u.createdById as string] as unknown as Korisnik,
    odjel: odMap[u.odjelId as string] as unknown as Odjel,
  }));
}

export async function createUnos(form: UnosRadaForm): Promise<UnosRada> {
  const datum = Timestamp.fromDate(new Date(form.datum));
  const data: Record<string, unknown> = {
    datum,
    vrsta: form.vrsta,
    inzinjerId: form.inzinjerId,
    odjelId: form.odjelId || null,
    napomena: form.napomena || null,
    brojStabala: null,
    hektari: null,
    kilometri: null,
    createdById: form.createdById ?? null,
    createdByRole: form.createdByRole ?? null,
  };

  if (form.vrsta === 'DOZNAKA') {
    data.brojStabala = Number(form.brojStabala) || null;
    data.hektari = Number(form.hektari) || null;
  } else if (form.vrsta === 'VLAKA') {
    data.kilometri = Number(form.kilometri) || null;
  }
  // GODISNJI, KANCELARIJA, BOLOVANJE, TEREN — nema numeričkih polja

  const raw = await create('unosi', data);
  // upis je već u redu za slanje; offline promašaj cache-a ovdje ne smije prijaviti grešku
  const lookup = (col: string, id: string) => getById(col, id).catch(() => null);
  const [inzinjer, odjel, korisnik] = await Promise.all([
    lookup('inzinjeri', form.inzinjerId),
    form.odjelId ? lookup('odjeli', form.odjelId) : Promise.resolve(null),
    lookup('users', form.inzinjerId),
  ]);
  return {
    ...(raw as unknown as UnosRada),
    inzinjer: inzinjer as unknown as Inzinjer,
    korisnik: korisnik as unknown as Korisnik,
    odjel: odjel as unknown as Odjel,
  };
}

export async function deleteUnos(id: string): Promise<void> {
  await remove('unosi', id);
}

export async function updateUnos(id: string, data: {
  vrsta?: string;
  inzinjerId?: string;
  odjelId?: string | null;
  brojStabala?: number | null;
  hektari?: number | null;
  kilometri?: number | null;
  napomena?: string | null;
  updatedById?: string | null;
  updatedByRole?: string | null;
}): Promise<void> {
  await update('unosi', id, data as Record<string, unknown>);
}

export async function getUnosiZaDan(dateStr: string): Promise<UnosRada[]> {
  const [y, m, d] = dateStr.split('-').map(Number);
  const od = new Date(y, m - 1, d, 0, 0, 0, 0);
  const do_ = new Date(y, m - 1, d, 23, 59, 59, 999);

  const [unosiRaw, inzinjeriRaw, odjeliRaw, korisnaciRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
      orderBy('datum', 'asc'),
    ]),
    getAll('inzinjeri'),
    getAll('odjeli'),
    getAll('users'),
  ]);

  const inzMap = Object.fromEntries(inzinjeriRaw.map((i) => [i.id as string, i]));
  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
  const korMap = Object.fromEntries(korisnaciRaw.map((k) => [k.id as string, k]));

  return unosiRaw.map((u) => ({
    ...(u as unknown as UnosRada),
    inzinjer: inzMap[u.inzinjerId as string] as unknown as Inzinjer,
    korisnik: korMap[u.inzinjerId as string] as unknown as Korisnik,
    creator: korMap[u.createdById as string] as unknown as Korisnik,
    odjel: odMap[u.odjelId as string] as unknown as Odjel,
  }));
}

// ── Rezime (početna stranica) ─────────────────────────────────────────────────

export interface MjesecniRezime {
  ha: number; stabala: number; km: number;
  /** Dani (projektant × dan), ne broj unosa — dva unosa istog dana su jedan dan */
  godisnji: number; kancelarija: number; bolovanje: number; teren: number;
  /** Dani na poslu: teren, kancelarija, doznaka ili vlaka */
  radniDani: number;
  ukupno: number;
}

function rezimeIzUnosa(unosi: Record<string, unknown>[]): MjesecniRezime {
  const r: MjesecniRezime = { ha: 0, stabala: 0, km: 0, godisnji: 0, kancelarija: 0, bolovanje: 0, teren: 0, radniDani: 0, ukupno: unosi.length };
  const vrstaDani = new Set<string>();
  const radni = new Set<string>();
  const brojac = { GODISNJI: 'godisnji', KANCELARIJA: 'kancelarija', BOLOVANJE: 'bolovanje', TEREN: 'teren' } as const;
  for (const u of unosi) {
    const vrsta = u.vrsta as string;
    const dan = `${u.inzinjerId}|${(u.datum as string).slice(0, 10)}`;
    if (vrsta === 'DOZNAKA') { r.ha += Number(u.hektari) || 0; r.stabala += Number(u.brojStabala) || 0; }
    else if (vrsta === 'VLAKA') r.km += Number(u.kilometri) || 0;
    const key = brojac[vrsta as keyof typeof brojac];
    if (key && !vrstaDani.has(`${dan}|${vrsta}`)) { vrstaDani.add(`${dan}|${vrsta}`); r[key]++; }
    if (vrsta !== 'GODISNJI' && vrsta !== 'BOLOVANJE') radni.add(dan);
  }
  r.radniDani = radni.size;
  return r;
}

function tekuciMjesecRaspon() {
  const now = new Date();
  const od = new Date(now.getFullYear(), now.getMonth(), 1);
  const do_ = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return [where('datum', '>=', Timestamp.fromDate(od)), where('datum', '<=', Timestamp.fromDate(do_))];
}

export async function getMjesecniRezime(): Promise<MjesecniRezime> {
  return rezimeIzUnosa(await queryUnosi(tekuciMjesecRaspon()));
}

// ids: korisnik.id + legacy inzinjer.id-evi (stariji unosi su vezani za inzinjeri kolekciju)
export async function getMjesecniRezimeMoj(ids: readonly string[]): Promise<MjesecniRezime> {
  const idSet = new Set(ids);
  const unosi = await queryUnosi(tekuciMjesecRaspon());
  return rezimeIzUnosa(unosi.filter((u) => idSet.has(u.inzinjerId as string)));
}

export async function getUnosiZaMjesec(year: number, month: number): Promise<UnosRada[]> {
  const od = new Date(year, month - 1, 1);
  const do_ = new Date(year, month, 0);
  do_.setHours(23, 59, 59, 999);

  const [unosiRaw, inzinjeriRaw, odjeliRaw, korisnaciRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
      orderBy('datum', 'asc'),
    ]),
    getAll('inzinjeri'),
    getAll('odjeli'),
    getAll('users'),
  ]);

  const inzMap = Object.fromEntries(inzinjeriRaw.map((i) => [i.id as string, i]));
  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
  const korMap = Object.fromEntries(korisnaciRaw.map((k) => [k.id as string, k]));

  return unosiRaw.map((u) => ({
    ...(u as unknown as UnosRada),
    inzinjer: inzMap[u.inzinjerId as string] as unknown as Inzinjer,
    korisnik: korMap[u.inzinjerId as string] as unknown as Korisnik,
    creator: korMap[u.createdById as string] as unknown as Korisnik,
    updater: korMap[(u as Record<string, unknown>).updatedById as string] as unknown as Korisnik,
    odjel: odMap[u.odjelId as string] as unknown as Odjel,
  }));
}

// ── Pregled odjela ───────────────────────────────────────────────────────────

export interface OdjelPregledData {
  odjel: Odjel | null;
  unosi: UnosRada[];
}

/**
 * Svi unosi u odjelu, svih projektanata (kao Moji odjeli: rad u odjelu je zajednički).
 * Server-first jer projektantov cache ima samo njegove unose; offline pada na cache.
 */
export async function getOdjelPregled(odjelId: string): Promise<OdjelPregledData> {
  const [raw, odjelRaw, usersRaw] = await Promise.all([
    queryColFresh('unosi', [where('odjelId', '==', odjelId)]),
    getById('odjeli', odjelId).catch(() => null),
    getAll('users'),
  ]);
  const korMap = Object.fromEntries(usersRaw.map((k) => [k.id as string, k as unknown as Korisnik]));
  const unosi = (await normalizujProjektante(raw)).map((u) => ({
    ...(u as unknown as UnosRada),
    korisnik: korMap[u.inzinjerId as string],
    creator: korMap[u.createdById as string],
  }));
  unosi.sort((a, b) => a.datum.localeCompare(b.datum));
  return { odjel: odjelRaw as unknown as Odjel | null, unosi };
}

// ── Šihtarica ────────────────────────────────────────────────────────────────

export async function getSihtarica(korisnikId: string, year: number, month: number): Promise<UnosRada[]> {
  return (await getUnosiZaMjesec(year, month)).filter((u) => u.inzinjerId === korisnikId);
}

// Filter samo po vrsti (jedno polje) — upit ne traži composite index; datum se filtrira u goPeriod
export async function getGodisnjiUnosi(korisnikId: string): Promise<UnosRada[]> {
  const raw = await queryUnosi([where('vrsta', '==', 'GODISNJI')]);
  return (raw as unknown as UnosRada[]).filter((u) => u.inzinjerId === korisnikId);
}

export async function setGoDanaPoUgovoru(korisnikId: string, periodGodina: number, dana: number | null): Promise<void> {
  await update('users', korisnikId, { [`goDanaPoUgovoru.${periodGodina}`]: dana });
}

// ── Moji odjeli ──────────────────────────────────────────────────────────────

export async function getMojiOdjeliData(): Promise<{
  odjeli: Odjel[];
  korisnici: Korisnik[];
}> {
  const [odjeliRaw, korisnaciRaw] = await Promise.all([getAll('odjeli'), getAll('users')]);
  const odjeli = (odjeliRaw as unknown as Odjel[]).sort(cmpOdjel);
  return { odjeli, korisnici: korisnaciRaw as unknown as Korisnik[] };
}

export type OdjelUcinak = { ha: number; stabala: number; km: number };

/** Ukupan rad svih projektanata, ali samo u traženim odjelima (ne cijela baza) */
export async function getUcinakPoOdjelima(odjelIds: readonly string[]): Promise<Record<string, OdjelUcinak>> {
  const chunks: string[][] = [];
  for (let i = 0; i < odjelIds.length; i += 30) chunks.push(odjelIds.slice(i, i + 30)); // limit za "in"
  const results = await Promise.all(chunks.map((c) => queryColFresh('unosi', [where('odjelId', 'in', c)])));

  const stats: Record<string, OdjelUcinak> = {};
  for (const u of results.flat()) {
    const odjelId = u.odjelId as string;
    if (!stats[odjelId]) stats[odjelId] = { ha: 0, stabala: 0, km: 0 };
    if (u.vrsta === 'DOZNAKA') {
      stats[odjelId].ha += Number(u.hektari) || 0;
      stats[odjelId].stabala += Number(u.brojStabala) || 0;
    } else if (u.vrsta === 'VLAKA') {
      stats[odjelId].km += Number(u.kilometri) || 0;
    }
  }
  return stats;
}

// ── Sedmična tabela ──────────────────────────────────────────────────────────

export interface DnevnaAktivnost {
  vrsta: string;
  gjBroj: string | null;
  stabala: number;
  ha: number;
  km: number;
}

export async function getSedmicnaTabela(refDate?: Date): Promise<{
  radnici: { id: string; name: string }[];
  entries: Record<string, Record<number, DnevnaAktivnost[]>>;
  od: string;
  do_: string;
}> {
  const now = refDate ?? new Date();
  const day = now.getDay() || 7;
  const od = new Date(now);
  od.setDate(now.getDate() - day + 1);
  od.setHours(0, 0, 0, 0);
  const do_ = new Date(od);
  do_.setDate(od.getDate() + 6);
  do_.setHours(23, 59, 59, 999);

  const [unosiRaw, korisnaciRaw, odjeliRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('users'),
    getAll('odjeli'),
  ]);

  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
  const entries: Record<string, Record<number, DnevnaAktivnost[]>> = {};

  for (const u of unosiRaw) {
    const radnikId = u.inzinjerId as string;
    const datumStr = u.datum as string;
    const d = new Date(datumStr);
    const dow = d.getDay() || 7; // 1=Pon … 7=Ned

    if (!entries[radnikId]) entries[radnikId] = {};
    if (!entries[radnikId][dow]) entries[radnikId][dow] = [];

    const odjel = odMap[u.odjelId as string];
    const gjBroj = odjel ? `${odjel.gj} ${odjel.broj}` : null;

    entries[radnikId][dow].push({
      vrsta: u.vrsta as string,
      gjBroj,
      stabala: Number(u.brojStabala) || 0,
      ha: Number(u.hektari) || 0,
      km: Number(u.kilometri) || 0,
    });
  }

  const radnici = (korisnaciRaw as unknown as Korisnik[])
    .filter((k) => isReportWorker(k, !!entries[k.id]))
    .sort((a, b) => (a.fullName || a.ime).localeCompare(b.fullName || b.ime))
    .map((k) => ({ id: k.id, name: k.fullName || k.ime }));

  return { radnici, entries, od: localDateStr(od), do_: localDateStr(do_) };
}

// ── Izvještaji ────────────────────────────────────────────────────────────────

function getDateRange(period: 'sedmicno' | 'mjesecno' | 'godisnje', refDate?: Date): {
  od: Date;
  do_: Date;
} {
  const now = refDate ?? new Date();

  if (period === 'sedmicno') {
    const day = now.getDay() || 7;
    const od = new Date(now);
    od.setDate(now.getDate() - day + 1);
    od.setHours(0, 0, 0, 0);
    const do_ = new Date(od);
    do_.setDate(od.getDate() + 6);
    do_.setHours(23, 59, 59, 999);
    return { od, do_ };
  } else if (period === 'mjesecno') {
    const od = new Date(now.getFullYear(), now.getMonth(), 1);
    const do_ = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    do_.setHours(23, 59, 59, 999);
    return { od, do_ };
  } else {
    const od = new Date(now.getFullYear(), 0, 1);
    const do_ = new Date(now.getFullYear(), 11, 31);
    do_.setHours(23, 59, 59, 999);
    return { od, do_ };
  }
}

export async function getIzvjestaj(
  period: 'sedmicno' | 'mjesecno' | 'godisnje',
  tip: 'odjel' | 'inzinjer',
  refDate?: Date
) {
  const { od, do_ } = getDateRange(period, refDate);

  const [unosiRaw, odjeliRaw, korisnaciRaw, doKrajaRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('odjeli'),
    getAll('users'),
    tip === 'odjel'
      ? queryUnosi( [where('datum', '<=', Timestamp.fromDate(do_))])
      : Promise.resolve([]),
  ]);

  if (tip === 'odjel') {
    // Preostalo i napredak moraju uključiti i ranije periode, ne samo odabrani
    const kumulativnoHa: Record<string, number> = {};
    for (const u of doKrajaRaw) {
      if (u.vrsta !== 'DOZNAKA' || !u.odjelId) continue;
      const k = u.odjelId as string;
      kumulativnoHa[k] = (kumulativnoHa[k] || 0) + (Number(u.hektari) || 0);
    }

    const grouped: Record<string, { ha: number; stabala: number; km: number; count: number }> = {};
    for (const u of unosiRaw) {
      const key = u.odjelId as string;
      if (!grouped[key]) grouped[key] = { ha: 0, stabala: 0, km: 0, count: 0 };
      grouped[key].ha += Number(u.hektari) || 0;
      grouped[key].stabala += Number(u.brojStabala) || 0;
      grouped[key].km += Number(u.kilometri) || 0;
      grouped[key].count++;
    }

    const data = odjeliRaw
      .filter((o) => !!grouped[o.id as string])  // samo odjeli s aktivnošću u periodu
      .sort(cmpOdjel)
      .map((o) => {
        const g = grouped[o.id as string];
        const povrsina = Number(o.povrsina) || 0;
        const kumulativno = kumulativnoHa[o.id as string] || 0;
        const preostalo = povrsina - kumulativno;
        const postotak = povrsina > 0 ? Math.round((kumulativno / povrsina) * 100) : 0;
        return {
          odjel: { id: o.id, gj: o.gj, broj: o.broj, povrsina },
          ukupnoHektara: g.ha,
          kumulativnoHektara: kumulativno,
          ukupnoStabala: g.stabala,
          ukupnoKm: g.km,
          preostalo,
          postotak,
          brojUnosa: g.count,
        };
      });

    return { period, od: localDateStr(od), do_: localDateStr(do_), tip, data };
  } else {
    const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
    const grouped: Record<string, {
      ha: number; stabala: number; km: number; count: number;
      godisnji: Set<string>; kancelarija: Set<string>; bolovanje: Set<string>;
      odjeliIds: Set<string>;
      terenDani: Set<string>;
      radniDani: Set<string>;
    }> = {};
    const emptyGroup = () => ({ ha: 0, stabala: 0, km: 0, count: 0, godisnji: new Set<string>(), kancelarija: new Set<string>(), bolovanje: new Set<string>(), odjeliIds: new Set<string>(), terenDani: new Set<string>(), radniDani: new Set<string>() });
    for (const u of unosiRaw) {
      const key = u.inzinjerId as string;
      if (!grouped[key]) grouped[key] = emptyGroup();
      const dan = (u.datum as string).slice(0, 10);
      grouped[key].ha += Number(u.hektari) || 0;
      grouped[key].stabala += Number(u.brojStabala) || 0;
      grouped[key].km += Number(u.kilometri) || 0;
      grouped[key].count++;
      if (u.odjelId) grouped[key].odjeliIds.add(u.odjelId as string);
      if (u.vrsta === 'GODISNJI') grouped[key].godisnji.add(dan);
      else if (u.vrsta === 'KANCELARIJA') grouped[key].kancelarija.add(dan);
      else if (u.vrsta === 'BOLOVANJE') grouped[key].bolovanje.add(dan);
      else if (u.vrsta === 'TEREN' || u.vrsta === 'DOZNAKA' || u.vrsta === 'VLAKA') grouped[key].terenDani.add(dan);
      // dan s terenom i kancelarijom je jedan radni dan, ne dva
      if (u.vrsta !== 'GODISNJI' && u.vrsta !== 'BOLOVANJE') grouped[key].radniDani.add(dan);
    }

    const workers = (korisnaciRaw as unknown as Korisnik[])
      .filter((k) => isReportWorker(k, !!grouped[k.id]))
      .sort((a, b) => (a.fullName || a.ime).localeCompare(b.fullName || b.ime));

    const data = workers.map((k) => {
        const g = grouped[k.id] || emptyGroup();
        const odjeli = Array.from(g.odjeliIds)
          .map((id) => (odMap[id] as Record<string, unknown>)?.broj as string ?? id)
          .sort((a, b) => a.localeCompare(b));
        return {
          inzinjer: {
            id: k.id,
            ime: k.fullName || k.ime,
            prezime: '',
            odjeli,
          },
          ukupnoHektara: g.ha,
          ukupnoStabala: g.stabala,
          ukupnoKm: g.km,
          danaGodisnji: g.godisnji.size,
          danaKancelarija: g.kancelarija.size,
          danaBolovanje: g.bolovanje.size,
          danaTeren: g.terenDani.size,
          danaRadnih: g.radniDani.size,
          brojUnosa: g.count,
        };
      });

    return { period, od: localDateStr(od), do_: localDateStr(do_), tip, data };
  }
}

// ── Period rada u odjelu ──────────────────────────────────────────────────────

export interface OdjelPeriodRada {
  odjelId: string;
  doznaka: { od: string; do_: string } | null;
  vlaka: { od: string; do_: string } | null;
}

export async function getUnosiOdjelPeriod(year?: number): Promise<OdjelPeriodRada[]> {
  const raw = await queryUnosi([]);
  const godina = year ? String(year) : null;
  const periodi: Record<string, { doznakaMin: string | null; doznakaMax: string | null; vlakaMin: string | null; vlakaMax: string | null }> = {};

  for (const u of raw) {
    const vrsta = u.vrsta as string;
    if (vrsta !== 'DOZNAKA' && vrsta !== 'VLAKA') continue;
    const odjelId = u.odjelId as string;
    if (!odjelId) continue;
    const datumStr = (u.datum as string).slice(0, 10);
    if (godina && !datumStr.startsWith(godina)) continue;
    if (!periodi[odjelId]) periodi[odjelId] = { doznakaMin: null, doznakaMax: null, vlakaMin: null, vlakaMax: null };
    const p = periodi[odjelId];
    if (vrsta === 'DOZNAKA') {
      if (!p.doznakaMin || datumStr < p.doznakaMin) p.doznakaMin = datumStr;
      if (!p.doznakaMax || datumStr > p.doznakaMax) p.doznakaMax = datumStr;
    } else {
      if (!p.vlakaMin || datumStr < p.vlakaMin) p.vlakaMin = datumStr;
      if (!p.vlakaMax || datumStr > p.vlakaMax) p.vlakaMax = datumStr;
    }
  }

  return Object.entries(periodi).map(([odjelId, p]) => ({
    odjelId,
    doznaka: p.doznakaMin ? { od: p.doznakaMin, do_: p.doznakaMax! } : null,
    vlaka: p.vlakaMin ? { od: p.vlakaMin, do_: p.vlakaMax! } : null,
  }));
}

export interface OdjelMjesecRezime {
  odjelId: string;
  gj: string;
  broj: string;
  ha: number;
  stabala: number;
  km: number;
  vrste: string[];
}

export async function getMjesecniRezimePoOdjelima(ids?: readonly string[]): Promise<OdjelMjesecRezime[]> {
  const idSet = ids ? new Set(ids) : null;
  const now = new Date();
  const od = new Date(now.getFullYear(), now.getMonth(), 1);
  const do_ = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  do_.setHours(23, 59, 59, 999);

  const [unosiRaw, odjeliRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('odjeli'),
  ]);

  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o as unknown as Odjel]));
  const acc: Record<string, { ha: number; stabala: number; km: number; vrste: Set<string> }> = {};

  for (const u of unosiRaw) {
    if (idSet && !idSet.has(u.inzinjerId as string)) continue;
    const vrsta = u.vrsta as string;
    const odjelId = u.odjelId as string;
    if (!odjelId) continue;
    if (!acc[odjelId]) acc[odjelId] = { ha: 0, stabala: 0, km: 0, vrste: new Set() };
    const a = acc[odjelId];
    a.vrste.add(vrsta);
    if (vrsta === 'DOZNAKA') { a.ha += Number(u.hektari) || 0; a.stabala += Number(u.brojStabala) || 0; }
    else if (vrsta === 'VLAKA') a.km += Number(u.kilometri) || 0;
  }

  return Object.entries(acc)
    .map(([odjelId, a]) => {
      const o = odMap[odjelId];
      return {
        odjelId,
        gj: o?.gj ?? '—',
        broj: o?.broj ?? '—',
        ha: a.ha,
        stabala: a.stabala,
        km: a.km,
        vrste: [...a.vrste],
      };
    })
    .sort(cmpOdjel);
}

// ── Statistika ────────────────────────────────────────────────────────────────

export interface PrisutnostRow {
  radnikId: string;
  ime: string;
  podaci: Record<number, { teren: number; kancelarija: number; godisnji: number; bolovanje: number }>;
}

export async function getStatistikaPrisutnosti(year: number): Promise<PrisutnostRow[]> {
  const od = new Date(year, 0, 1);
  const do_ = new Date(year, 11, 31, 23, 59, 59, 999);

  const [unosiRaw, korisnaciRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('users'),
  ]);

  const acc: Record<string, Record<number, { teren: number; kancelarija: number; godisnji: number; bolovanje: number }>> = {};
  const seen = new Set<string>();
  // doznaka i vlaka su terenski dani — isto brojanje kao Izvještaji i Početna
  const KEY = { TEREN: 'teren', DOZNAKA: 'teren', VLAKA: 'teren', KANCELARIJA: 'kancelarija', GODISNJI: 'godisnji', BOLOVANJE: 'bolovanje' } as const;

  for (const u of unosiRaw) {
    const key = KEY[u.vrsta as keyof typeof KEY];
    const id = u.inzinjerId as string;
    if (!key || !id) continue;
    const dan = (u.datum as string).slice(0, 10);
    // isti dan i vrsta se broje jednom, i kad postoji više unosa
    const dedupe = `${id}|${key}|${dan}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const m = Number(dan.slice(5, 7));
    if (!acc[id]) acc[id] = {};
    if (!acc[id][m]) acc[id][m] = { teren: 0, kancelarija: 0, godisnji: 0, bolovanje: 0 };
    acc[id][m][key]++;
  }

  const workers = (korisnaciRaw as unknown as Korisnik[])
    .filter((k) => isReportWorker(k, !!acc[k.id]))
    .sort((a, b) => (a.fullName || a.ime).localeCompare(b.fullName || b.ime));

  return workers.map((k) => ({
    radnikId: k.id,
    ime: k.fullName || k.ime,
    podaci: acc[k.id] || {},
  }));
}

export interface UcinakMjesec {
  mjesec: number;
  ha: number;
  stabala: number;
  km: number;
}

export async function getStatistikaUcinka(year: number, inzinjerId?: string): Promise<UcinakMjesec[]> {
  const od = new Date(year, 0, 1);
  const do_ = new Date(year, 11, 31, 23, 59, 59, 999);

  const unosiRaw = await queryUnosi( [
    where('datum', '>=', Timestamp.fromDate(od)),
    where('datum', '<=', Timestamp.fromDate(do_)),
  ]);

  const acc: Record<number, { ha: number; stabala: number; km: number }> = {};
  for (let m = 1; m <= 12; m++) acc[m] = { ha: 0, stabala: 0, km: 0 };

  for (const u of unosiRaw) {
    if (inzinjerId && u.inzinjerId !== inzinjerId) continue;
    const vrsta = u.vrsta as string;
    if (vrsta !== 'DOZNAKA' && vrsta !== 'VLAKA') continue;
    const m = Number((u.datum as string).slice(5, 7));
    if (vrsta === 'DOZNAKA') {
      acc[m].ha += Number(u.hektari) || 0;
      acc[m].stabala += Number(u.brojStabala) || 0;
    } else {
      acc[m].km += Number(u.kilometri) || 0;
    }
  }

  return Array.from({ length: 12 }, (_, i) => ({ mjesec: i + 1, ...acc[i + 1] }));
}

export interface OdjelStatistika {
  odjelId: string;
  gj: string;
  broj: string;
  totalHa: number;
  totalStabala: number;
  totalKm: number;
  projektanti: { radnikId: string; ime: string; ha: number; stabala: number; km: number }[];
}

export async function getStatistikaPoOdjelima(year: number, month?: number): Promise<OdjelStatistika[]> {
  const od = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const do_ = month ? new Date(year, month, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999);

  const [unosiRaw, odjeliRaw, korisnaciRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('odjeli'),
    getAll('users'),
  ]);

  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o as unknown as Odjel]));
  const korMap = Object.fromEntries(
    (korisnaciRaw as unknown as Korisnik[]).map((k) => [k.id, k.fullName || k.ime])
  );

  // odjel → projektant → stats
  const acc: Record<string, Record<string, { ha: number; stabala: number; km: number }>> = {};

  for (const u of unosiRaw) {
    const vrsta = u.vrsta as string;
    if (vrsta !== 'DOZNAKA' && vrsta !== 'VLAKA') continue;
    const odjelId = u.odjelId as string;
    const radnikId = u.inzinjerId as string;
    if (!odjelId || !radnikId) continue;
    if (!acc[odjelId]) acc[odjelId] = {};
    if (!acc[odjelId][radnikId]) acc[odjelId][radnikId] = { ha: 0, stabala: 0, km: 0 };
    const a = acc[odjelId][radnikId];
    if (vrsta === 'DOZNAKA') { a.ha += Number(u.hektari) || 0; a.stabala += Number(u.brojStabala) || 0; }
    else a.km += Number(u.kilometri) || 0;
  }

  return Object.entries(acc)
    .map(([odjelId, radnici]) => {
      const o = odMap[odjelId];
      const projektanti = Object.entries(radnici)
        .map(([radnikId, s]) => ({ radnikId, ime: korMap[radnikId] ?? radnikId, ...s }))
        .sort((a, b) => b.ha - a.ha);
      return {
        odjelId,
        gj: o?.gj ?? '—',
        broj: o?.broj ?? '—',
        totalHa: projektanti.reduce((s, p) => s + p.ha, 0),
        totalStabala: projektanti.reduce((s, p) => s + p.stabala, 0),
        totalKm: projektanti.reduce((s, p) => s + p.km, 0),
        projektanti,
      };
    })
    .sort(cmpOdjel);
}

export interface UporedbaRed {
  radnikId: string;
  ime: string;
  ha: number;
  stabala: number;
  km: number;
}

export async function getUporedbaUcinka(year: number, month?: number): Promise<UporedbaRed[]> {
  const od = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const do_ = month ? new Date(year, month, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999);

  const [unosiRaw, korisnaciRaw] = await Promise.all([
    queryUnosi( [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('users'),
  ]);

  const acc: Record<string, { ha: number; stabala: number; km: number }> = {};

  for (const u of unosiRaw) {
    const vrsta = u.vrsta as string;
    if (vrsta !== 'DOZNAKA' && vrsta !== 'VLAKA') continue;
    const id = u.inzinjerId as string;
    if (!id) continue;
    if (!acc[id]) acc[id] = { ha: 0, stabala: 0, km: 0 };
    if (vrsta === 'DOZNAKA') {
      acc[id].ha += Number(u.hektari) || 0;
      acc[id].stabala += Number(u.brojStabala) || 0;
    } else {
      acc[id].km += Number(u.kilometri) || 0;
    }
  }

  const workers = (korisnaciRaw as unknown as Korisnik[])
    .filter((k) => isReportWorker(k, !!acc[k.id]))
    .sort((a, b) => (acc[b.id]?.ha ?? 0) - (acc[a.id]?.ha ?? 0));

  return workers.map((k) => ({
    radnikId: k.id,
    ime: k.fullName || k.ime,
    ha: acc[k.id]?.ha ?? 0,
    stabala: acc[k.id]?.stabala ?? 0,
    km: acc[k.id]?.km ?? 0,
  }));
}

// ── Detaljan pregled po odjelima ──────────────────────────────────────────────

export interface DetaljanOdjelRed {
  odjelId: string;
  gj: string;
  broj: string;
  povrsina: number | null;
  totalHa: number;
  totalStabala: number;
  totalKm: number;
  doznakaOd: string | null;
  doznakaDo: string | null;
  doznakaRadnihDana: number;
  vlakaOd: string | null;
  vlakaDo: string | null;
  vlakaRadnihDana: number;
  projektanti: { radnikId: string; ime: string; ha: number; stabala: number; km: number; dozDana: number; vlaDana: number }[];
}

export async function getDetaljanPregledPoOdjelima(year: number): Promise<DetaljanOdjelRed[]> {
  const od = new Date(year, 0, 1);
  const do_ = new Date(year, 11, 31, 23, 59, 59, 999);

  const [unosiRaw, odjeliRaw, korisnaciRaw] = await Promise.all([
    queryUnosi([
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('odjeli'),
    getAll('users'),
  ]);

  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o as unknown as Odjel]));
  const korMap = Object.fromEntries(
    (korisnaciRaw as unknown as Korisnik[]).map((k) => [k.id, k.fullName || k.ime])
  );

  type OdjelAcc = {
    doz: { dates: Set<string>; ha: number; stabala: number };
    vla: { dates: Set<string>; km: number };
    projektanti: Record<string, { ha: number; stabala: number; km: number; dozDani: Set<string>; vlaDani: Set<string> }>;
  };
  const acc: Record<string, OdjelAcc> = {};

  for (const u of unosiRaw) {
    const vrsta = u.vrsta as string;
    if (vrsta !== 'DOZNAKA' && vrsta !== 'VLAKA') continue;
    const odjelId = u.odjelId as string;
    const radnikId = u.inzinjerId as string;
    if (!odjelId || !radnikId) continue;
    const datum = (u.datum as string).slice(0, 10);
    if (!acc[odjelId]) acc[odjelId] = {
      doz: { dates: new Set(), ha: 0, stabala: 0 },
      vla: { dates: new Set(), km: 0 },
      projektanti: {},
    };
    const a = acc[odjelId];
    if (!a.projektanti[radnikId]) a.projektanti[radnikId] = { ha: 0, stabala: 0, km: 0, dozDani: new Set(), vlaDani: new Set() };
    const p = a.projektanti[radnikId];
    if (vrsta === 'DOZNAKA') {
      a.doz.dates.add(datum);
      a.doz.ha += Number(u.hektari) || 0;
      a.doz.stabala += Number(u.brojStabala) || 0;
      p.dozDani.add(datum);
      p.ha += Number(u.hektari) || 0;
      p.stabala += Number(u.brojStabala) || 0;
    } else {
      a.vla.dates.add(datum);
      a.vla.km += Number(u.kilometri) || 0;
      p.vlaDani.add(datum);
      p.km += Number(u.kilometri) || 0;
    }
  }

  const minMax = (s: Set<string>) => { const a = [...s].sort(); return { min: a[0] ?? null, max: a[a.length - 1] ?? null, size: a.length }; };

  return Object.entries(acc)
    .map(([odjelId, a]) => {
      const o = odMap[odjelId];
      const doz = minMax(a.doz.dates);
      const vla = minMax(a.vla.dates);
      const projektanti = Object.entries(a.projektanti)
        .map(([radnikId, p]) => ({
          radnikId,
          ime: korMap[radnikId] ?? radnikId,
          ha: p.ha,
          stabala: p.stabala,
          km: p.km,
          dozDana: p.dozDani.size,
          vlaDana: p.vlaDani.size,
        }))
        .sort((x, y) => y.ha - x.ha || y.km - x.km);
      return {
        odjelId,
        gj: o?.gj ?? '—',
        broj: o?.broj ?? '—',
        povrsina: (o as unknown as Record<string, unknown>)?.povrsina as number ?? null,
        totalHa: a.doz.ha,
        totalStabala: a.doz.stabala,
        totalKm: a.vla.km,
        doznakaOd: doz.min,
        doznakaDo: doz.max,
        doznakaRadnihDana: doz.size,
        vlakaOd: vla.min,
        vlakaDo: vla.max,
        vlakaRadnihDana: vla.size,
        projektanti,
      };
    })
    .sort(cmpOdjel);
}
