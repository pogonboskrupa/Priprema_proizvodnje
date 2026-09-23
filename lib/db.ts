import {
  getAll,
  getById,
  create,
  update,
  remove,
  queryCol,
  Timestamp,
  where,
  orderBy,
} from './firebase';
import type { Odjel, Inzinjer, UnosRada, UnosRadaForm, Korisnik } from './types';

// ── Korisnici ─────────────────────────────────────────────────────────────────

export async function getKorisnici(): Promise<Korisnik[]> {
  const raw = await getAll('users');
  return (raw as unknown as Korisnik[]).sort((a, b) => a.ime.localeCompare(b.ime));
}

export async function getKorisnik(id: string): Promise<Korisnik | null> {
  const raw = await getById('users', id);
  return raw ? (raw as unknown as Korisnik) : null;
}

export async function getKorisnikByIme(ime: string): Promise<Korisnik | null> {
  const all = await queryCol('users', [where('ime', '==', ime.toUpperCase())]);
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

export async function deleteKorisnik(id: string): Promise<void> {
  await remove('users', id);
}

// ── Odjeli ────────────────────────────────────────────────────────────────────

export async function getOdjeli(): Promise<Odjel[]> {
  const [odjeliRaw, inzinjeriRaw, unosiRaw] = await Promise.all([
    getAll('odjeli'),
    getAll('inzinjeri'),
    getAll('unosi'),
  ]);

  return odjeliRaw
    .map((o) => ({
      ...(o as unknown as Odjel),
      _count: {
        inzinjeri: inzinjeriRaw.filter((i) => i.odjelId === o.id).length,
        unosi: unosiRaw.filter((u) => u.odjelId === o.id).length,
      },
    }))
    .sort((a, b) => String(a.broj).localeCompare(String(b.broj)));
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
  data: { gj?: string; broj?: string; povrsina?: number; plan_cet?: number; plan_lis?: number; real_cet?: number; real_lis?: number; doznaceno?: boolean; vlakeProjektovane?: boolean }
): Promise<Odjel> {
  const raw = await update('odjeli', id, data as Record<string, unknown>);
  return raw as unknown as Odjel;
}

export async function deleteOdjel(id: string): Promise<void> {
  await remove('odjeli', id);
}

// ── Inžinjeri ─────────────────────────────────────────────────────────────────

export async function getInzinjeri(): Promise<Inzinjer[]> {
  const [inzinjeriRaw, odjeliRaw] = await Promise.all([
    getAll('inzinjeri'),
    getAll('odjeli'),
  ]);

  const odjelMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));

  return inzinjeriRaw
    .map((i) => ({
      ...(i as unknown as Inzinjer),
      odjel: odjelMap[i.odjelId as string] as unknown as Odjel,
    }))
    .sort((a, b) =>
      `${a.prezime} ${a.ime}`.localeCompare(`${b.prezime} ${b.ime}`)
    );
}

export async function getInzinjerByKorisnikId(korisnikId: string): Promise<Inzinjer | null> {
  const [inzinjeriRaw, odjeliRaw] = await Promise.all([
    queryCol('inzinjeri', [where('korisnikId', '==', korisnikId)]),
    getAll('odjeli'),
  ]);
  if (!inzinjeriRaw.length) return null;
  const i = inzinjeriRaw[0];
  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
  return { ...(i as unknown as Inzinjer), odjel: odMap[i.odjelId as string] as unknown as Odjel };
}

export async function createInzinjer(data: {
  ime: string;
  prezime: string;
  email: string;
  odjelId: string;
  korisnikId?: string | null;
}): Promise<Inzinjer> {
  const raw = await create('inzinjeri', data as Record<string, unknown>);
  const odjel = await getById('odjeli', data.odjelId);
  return { ...(raw as unknown as Inzinjer), odjel: odjel as unknown as Odjel };
}

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

export async function updateInzinjer(
  id: string,
  data: { ime?: string; prezime?: string; email?: string; odjelId?: string; korisnikId?: string | null; planHa?: number; rjesenje?: boolean }
): Promise<Inzinjer> {
  const raw = await update('inzinjeri', id, data as Record<string, unknown>);
  const odjelId = (raw as Record<string, unknown>).odjelId as string;
  const odjel = await getById('odjeli', odjelId);
  return { ...(raw as unknown as Inzinjer), odjel: odjel as unknown as Odjel };
}

export async function deleteInzinjer(id: string): Promise<void> {
  await remove('inzinjeri', id);
}

export async function getGodisnjePlanPoInzinjeru(year: number) {
  const od = new Date(year, 0, 1);
  const do_ = new Date(year, 11, 31);
  do_.setHours(23, 59, 59, 999);

  const [unosiRaw, inzinjeriRaw, odjeliRaw] = await Promise.all([
    queryCol('unosi', [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('inzinjeri'),
    getAll('odjeli'),
  ]);

  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
  const haMap: Record<string, number> = {};
  const kmMap: Record<string, number> = {};

  for (const u of unosiRaw) {
    const id = u.inzinjerId as string;
    haMap[id] = (haMap[id] || 0) + (u.vrsta === 'DOZNAKA' ? (Number(u.hektari) || 0) : 0);
    kmMap[id] = (kmMap[id] || 0) + (u.vrsta === 'VLAKA' ? (Number(u.kilometri) || 0) : 0);
  }

  return (inzinjeriRaw as unknown as Inzinjer[])
    .map((i) => ({
      inzinjer: { ...i, odjel: odMap[i.odjelId] as unknown as Odjel },
      planHa: Number(i.planHa) || 0,
      odradjeno: haMap[i.id] || 0,
      odradjenoKm: kmMap[i.id] || 0,
    }))
    .sort((a, b) =>
      `${a.inzinjer.prezime} ${a.inzinjer.ime}`.localeCompare(`${b.inzinjer.prezime} ${b.inzinjer.ime}`)
    );
}

// ── Unosi ─────────────────────────────────────────────────────────────────────

export async function getUnosi(): Promise<UnosRada[]> {
  const [unosiRaw, inzinjeriRaw, odjeliRaw, korisnaciRaw] = await Promise.all([
    queryCol('unosi', [orderBy('datum', 'desc')]),
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
    odjelId: form.odjelId,
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
  const [inzinjer, odjel, korisnik] = await Promise.all([
    getById('inzinjeri', form.inzinjerId),
    getById('odjeli', form.odjelId),
    getById('users', form.inzinjerId),
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
  odjelId?: string;
  brojStabala?: number | null;
  hektari?: number | null;
  kilometri?: number | null;
  napomena?: string | null;
}): Promise<void> {
  await update('unosi', id, data as Record<string, unknown>);
}

export async function getUnosiZaDan(dateStr: string): Promise<UnosRada[]> {
  const [y, m, d] = dateStr.split('-').map(Number);
  const od = new Date(y, m - 1, d, 0, 0, 0, 0);
  const do_ = new Date(y, m - 1, d, 23, 59, 59, 999);

  const [unosiRaw, inzinjeriRaw, odjeliRaw, korisnaciRaw] = await Promise.all([
    queryCol('unosi', [
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

export async function getMjesecniRezime() {
  const now = new Date();
  const od = new Date(now.getFullYear(), now.getMonth(), 1);
  const do_ = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  do_.setHours(23, 59, 59, 999);

  const unosi = await queryCol('unosi', [
    where('datum', '>=', Timestamp.fromDate(od)),
    where('datum', '<=', Timestamp.fromDate(do_)),
  ]);

  return unosi.reduce(
    (acc: { ha: number; stabala: number; km: number; godisnji: number; kancelarija: number; bolovanje: number; teren: number; ukupno: number }, u) => {
      const vrsta = u.vrsta as string;
      if (vrsta === 'DOZNAKA') {
        acc.ha += Number(u.hektari) || 0;
        acc.stabala += Number(u.brojStabala) || 0;
      } else if (vrsta === 'VLAKA') {
        acc.km += Number(u.kilometri) || 0;
      } else if (vrsta === 'GODISNJI') acc.godisnji++;
      else if (vrsta === 'KANCELARIJA') acc.kancelarija++;
      else if (vrsta === 'BOLOVANJE') acc.bolovanje++;
      else if (vrsta === 'TEREN') acc.teren++;
      acc.ukupno++;
      return acc;
    },
    { ha: 0, stabala: 0, km: 0, godisnji: 0, kancelarija: 0, bolovanje: 0, teren: 0, ukupno: 0 }
  );
}

export async function getMjesecniRezimeMoj(inzinjerId: string) {
  const now = new Date();
  const od = new Date(now.getFullYear(), now.getMonth(), 1);
  const do_ = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  do_.setHours(23, 59, 59, 999);

  const unosi = await queryCol('unosi', [
    where('datum', '>=', Timestamp.fromDate(od)),
    where('datum', '<=', Timestamp.fromDate(do_)),
  ]);

  return unosi
    .filter((u) => u.inzinjerId === inzinjerId)
    .reduce(
      (acc: { ha: number; stabala: number; km: number; godisnji: number; kancelarija: number; bolovanje: number; teren: number; ukupno: number }, u) => {
        const vrsta = u.vrsta as string;
        if (vrsta === 'DOZNAKA') { acc.ha += Number(u.hektari) || 0; acc.stabala += Number(u.brojStabala) || 0; }
        else if (vrsta === 'VLAKA') acc.km += Number(u.kilometri) || 0;
        else if (vrsta === 'GODISNJI') acc.godisnji++;
        else if (vrsta === 'KANCELARIJA') acc.kancelarija++;
        else if (vrsta === 'BOLOVANJE') acc.bolovanje++;
        else if (vrsta === 'TEREN') acc.teren++;
        acc.ukupno++;
        return acc;
      },
      { ha: 0, stabala: 0, km: 0, godisnji: 0, kancelarija: 0, bolovanje: 0, teren: 0, ukupno: 0 }
    );
}

export async function getUnosiZaMjesec(year: number, month: number): Promise<UnosRada[]> {
  const od = new Date(year, month - 1, 1);
  const do_ = new Date(year, month, 0);
  do_.setHours(23, 59, 59, 999);

  const [unosiRaw, inzinjeriRaw, odjeliRaw] = await Promise.all([
    queryCol('unosi', [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
      orderBy('datum', 'asc'),
    ]),
    getAll('inzinjeri'),
    getAll('odjeli'),
  ]);

  const inzMap = Object.fromEntries(inzinjeriRaw.map((i) => [i.id as string, i]));
  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));

  return unosiRaw.map((u) => ({
    ...(u as unknown as UnosRada),
    inzinjer: inzMap[u.inzinjerId as string] as unknown as Inzinjer,
    odjel: odMap[u.odjelId as string] as unknown as Odjel,
  }));
}

// ── Moji odjeli ──────────────────────────────────────────────────────────────

export async function getMojiOdjeliData(): Promise<{
  odjeli: Odjel[];
  korisnici: Korisnik[];
  statsPerOdjel: Record<string, { ha: number; stabala: number; km: number }>;
}> {
  const [odjeliRaw, korisnaciRaw, unosiRaw] = await Promise.all([
    getAll('odjeli'),
    getAll('users'),
    getAll('unosi'),
  ]);

  const odjeli = (odjeliRaw as unknown as Odjel[]).sort((a, b) =>
    String(a.broj).localeCompare(String(b.broj))
  );
  const korisnici = korisnaciRaw as unknown as Korisnik[];

  const statsPerOdjel: Record<string, { ha: number; stabala: number; km: number }> = {};
  for (const u of unosiRaw) {
    const odjelId = u.odjelId as string;
    if (!statsPerOdjel[odjelId]) statsPerOdjel[odjelId] = { ha: 0, stabala: 0, km: 0 };
    if (u.vrsta === 'DOZNAKA') {
      statsPerOdjel[odjelId].ha += Number(u.hektari) || 0;
      statsPerOdjel[odjelId].stabala += Number(u.brojStabala) || 0;
    } else if (u.vrsta === 'VLAKA') {
      statsPerOdjel[odjelId].km += Number(u.kilometri) || 0;
    }
  }

  return { odjeli, korisnici, statsPerOdjel };
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
    queryCol('unosi', [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('users'),
    getAll('odjeli'),
  ]);

  const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
  const radnici = (korisnaciRaw as unknown as Korisnik[])
    .filter((k) => k.role === 'worker')
    .sort((a, b) => (a.fullName || a.ime).localeCompare(b.fullName || b.ime))
    .map((k) => ({ id: k.id, name: k.fullName || k.ime }));

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

  function fmtDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return { radnici, entries, od: fmtDate(od), do_: fmtDate(do_) };
}

// ── Izvještaji ────────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

  const [unosiRaw, odjeliRaw, korisnaciRaw] = await Promise.all([
    queryCol('unosi', [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('odjeli'),
    getAll('users'),
  ]);

  if (tip === 'odjel') {
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
      .sort((a, b) => String(a.broj).localeCompare(String(b.broj)))
      .map((o) => {
        const g = grouped[o.id as string];
        const povrsina = Number(o.povrsina) || 0;
        const preostalo = povrsina - g.ha;
        const postotak = povrsina > 0 ? Math.round((g.ha / povrsina) * 100) : 0;
        return {
          odjel: { id: o.id, gj: o.gj, broj: o.broj, povrsina },
          ukupnoHektara: g.ha,
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
      godisnji: number; kancelarija: number; bolovanje: number;
      odjeliIds: Set<string>;
      terenDani: Set<string>;
    }> = {};
    for (const u of unosiRaw) {
      const key = u.inzinjerId as string;
      if (!grouped[key]) grouped[key] = { ha: 0, stabala: 0, km: 0, count: 0, godisnji: 0, kancelarija: 0, bolovanje: 0, odjeliIds: new Set(), terenDani: new Set() };
      grouped[key].ha += Number(u.hektari) || 0;
      grouped[key].stabala += Number(u.brojStabala) || 0;
      grouped[key].km += Number(u.kilometri) || 0;
      grouped[key].count++;
      grouped[key].odjeliIds.add(u.odjelId as string);
      if (u.vrsta === 'GODISNJI') grouped[key].godisnji++;
      else if (u.vrsta === 'KANCELARIJA') grouped[key].kancelarija++;
      else if (u.vrsta === 'BOLOVANJE') grouped[key].bolovanje++;
      else if (u.vrsta === 'TEREN' || u.vrsta === 'DOZNAKA' || u.vrsta === 'VLAKA') {
        grouped[key].terenDani.add((u.datum as string).slice(0, 10));
      }
    }

    const workers = (korisnaciRaw as unknown as Korisnik[])
      .filter((k) => k.role === 'worker')
      .sort((a, b) => (a.fullName || a.ime).localeCompare(b.fullName || b.ime));

    const data = workers.map((k) => {
        const g = grouped[k.id] || { ha: 0, stabala: 0, km: 0, count: 0, godisnji: 0, kancelarija: 0, bolovanje: 0, odjeliIds: new Set<string>(), terenDani: new Set<string>() };
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
          danaGodisnji: g.godisnji,
          danaKancelarija: g.kancelarija,
          danaBolovanje: g.bolovanje,
          danaTeren: g.terenDani.size,
          brojUnosa: g.count,
        };
      });

    return { period, od: localDateStr(od), do_: localDateStr(do_), tip, data };
  }
}
