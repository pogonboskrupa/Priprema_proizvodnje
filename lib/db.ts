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
  naziv: string;
  broj: string;
  povrsina: number;
}): Promise<Odjel> {
  const raw = await create('odjeli', data as Record<string, unknown>);
  return raw as unknown as Odjel;
}

export async function updateOdjel(
  id: string,
  data: { naziv?: string; broj?: string; povrsina?: number; plan_cet?: number; plan_lis?: number; real_cet?: number; real_lis?: number }
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

export async function createInzinjer(data: {
  ime: string;
  prezime: string;
  email: string;
  odjelId: string;
}): Promise<Inzinjer> {
  const raw = await create('inzinjeri', data as Record<string, unknown>);
  const odjel = await getById('odjeli', data.odjelId);
  return { ...(raw as unknown as Inzinjer), odjel: odjel as unknown as Odjel };
}

export async function updateInzinjer(
  id: string,
  data: { ime?: string; prezime?: string; email?: string; odjelId?: string }
): Promise<Inzinjer> {
  const raw = await update('inzinjeri', id, data as Record<string, unknown>);
  const odjelId = (raw as Record<string, unknown>).odjelId as string;
  const odjel = await getById('odjeli', odjelId);
  return { ...(raw as unknown as Inzinjer), odjel: odjel as unknown as Odjel };
}

export async function deleteInzinjer(id: string): Promise<void> {
  await remove('inzinjeri', id);
}

// ── Unosi ─────────────────────────────────────────────────────────────────────

export async function getUnosi(): Promise<UnosRada[]> {
  const [unosiRaw, inzinjeriRaw, odjeliRaw] = await Promise.all([
    queryCol('unosi', [orderBy('datum', 'desc')]),
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
  };

  if (form.vrsta === 'DOZNAKA') {
    data.brojStabala = Number(form.brojStabala) || null;
    data.hektari = Number(form.hektari) || null;
  } else if (form.vrsta === 'VLAKA') {
    data.kilometri = Number(form.kilometri) || null;
  }
  // GODISNJI, KANCELARIJA, BOLOVANJE — nema numeričkih polja

  const raw = await create('unosi', data);
  const [inzinjer, odjel] = await Promise.all([
    getById('inzinjeri', form.inzinjerId),
    getById('odjeli', form.odjelId),
  ]);
  return {
    ...(raw as unknown as UnosRada),
    inzinjer: inzinjer as unknown as Inzinjer,
    odjel: odjel as unknown as Odjel,
  };
}

export async function deleteUnos(id: string): Promise<void> {
  await remove('unosi', id);
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
    (acc: { ha: number; stabala: number; km: number; godisnji: number; kancelarija: number; bolovanje: number; ukupno: number }, u) => {
      const vrsta = u.vrsta as string;
      if (vrsta === 'DOZNAKA') {
        acc.ha += Number(u.hektari) || 0;
        acc.stabala += Number(u.brojStabala) || 0;
      } else if (vrsta === 'VLAKA') {
        acc.km += Number(u.kilometri) || 0;
      } else if (vrsta === 'GODISNJI') acc.godisnji++;
      else if (vrsta === 'KANCELARIJA') acc.kancelarija++;
      else if (vrsta === 'BOLOVANJE') acc.bolovanje++;
      acc.ukupno++;
      return acc;
    },
    { ha: 0, stabala: 0, km: 0, godisnji: 0, kancelarija: 0, bolovanje: 0, ukupno: 0 }
  );
}

// ── Izvještaji ────────────────────────────────────────────────────────────────

function getDateRange(period: 'sedmicno' | 'mjesecno' | 'godisnje'): {
  od: Date;
  do_: Date;
} {
  const now = new Date();

  if (period === 'sedmicno') {
    const day = now.getDay() || 7;
    const od = new Date(now);
    od.setDate(now.getDate() - day + 1);
    od.setHours(0, 0, 0, 0);
    const do_ = new Date(now);
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
  tip: 'odjel' | 'inzinjer'
) {
  const { od, do_ } = getDateRange(period);

  const [unosiRaw, odjeliRaw, inzinjeriRaw] = await Promise.all([
    queryCol('unosi', [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
    ]),
    getAll('odjeli'),
    getAll('inzinjeri'),
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
      .sort((a, b) => String(a.broj).localeCompare(String(b.broj)))
      .map((o) => {
        const g = grouped[o.id as string] || { ha: 0, stabala: 0, km: 0, count: 0 };
        const povrsina = Number(o.povrsina) || 0;
        const preostalo = povrsina - g.ha;
        const postotak = povrsina > 0 ? Math.round((g.ha / povrsina) * 100) : 0;
        return {
          odjel: { id: o.id, naziv: o.naziv, broj: o.broj, povrsina },
          ukupnoHektara: g.ha,
          ukupnoStabala: g.stabala,
          ukupnoKm: g.km,
          preostalo,
          postotak,
          brojUnosa: g.count,
        };
      });

    return { period, od: od.toISOString(), do_: do_.toISOString(), tip, data };
  } else {
    const odMap = Object.fromEntries(odjeliRaw.map((o) => [o.id as string, o]));
    const grouped: Record<string, { ha: number; stabala: number; km: number; count: number; godisnji: number; kancelarija: number; bolovanje: number }> = {};
    for (const u of unosiRaw) {
      const key = u.inzinjerId as string;
      if (!grouped[key]) grouped[key] = { ha: 0, stabala: 0, km: 0, count: 0, godisnji: 0, kancelarija: 0, bolovanje: 0 };
      grouped[key].ha += Number(u.hektari) || 0;
      grouped[key].stabala += Number(u.brojStabala) || 0;
      grouped[key].km += Number(u.kilometri) || 0;
      grouped[key].count++;
      if (u.vrsta === 'GODISNJI') grouped[key].godisnji++;
      else if (u.vrsta === 'KANCELARIJA') grouped[key].kancelarija++;
      else if (u.vrsta === 'BOLOVANJE') grouped[key].bolovanje++;
    }

    const data = inzinjeriRaw
      .sort((a, b) =>
        `${a.prezime} ${a.ime}`.localeCompare(`${b.prezime} ${b.ime}`)
      )
      .map((i) => {
        const g = grouped[i.id as string] || { ha: 0, stabala: 0, km: 0, count: 0, godisnji: 0, kancelarija: 0, bolovanje: 0 };
        const odjel = odMap[i.odjelId as string] || { naziv: '–', broj: '–' };
        return {
          inzinjer: {
            id: i.id,
            ime: i.ime,
            prezime: i.prezime,
            odjel: { naziv: odjel.naziv, broj: odjel.broj },
          },
          ukupnoHektara: g.ha,
          ukupnoStabala: g.stabala,
          ukupnoKm: g.km,
          danaGodisnji: g.godisnji,
          danaKancelarija: g.kancelarija,
          danaBolovanje: g.bolovanje,
          brojUnosa: g.count,
        };
      });

    return { period, od: od.toISOString(), do_: do_.toISOString(), tip, data };
  }
}
