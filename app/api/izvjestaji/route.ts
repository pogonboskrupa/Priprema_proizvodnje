import { NextRequest, NextResponse } from 'next/server';
import { db, queryCol, getAll, Timestamp } from '@/lib/firebase';
import { where, orderBy } from 'firebase/firestore';
import type { UnosRada, Odjel, Inzinjer } from '@/lib/types';

function getPeriodRange(period: string, datum?: string) {
  const now = datum ? new Date(datum) : new Date();

  if (period === 'sedmicno') {
    const day = now.getDay() || 7;
    const od = new Date(now);
    od.setDate(now.getDate() - day + 1);
    od.setHours(0, 0, 0, 0);
    const do_ = new Date(od);
    do_.setDate(od.getDate() + 6);
    do_.setHours(23, 59, 59, 999);
    return { od, do_ };
  }

  if (period === 'mjesecno') {
    const od = new Date(now.getFullYear(), now.getMonth(), 1);
    const do_ = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { od, do_ };
  }

  // godisnje
  const od  = new Date(now.getFullYear(), 0, 1);
  const do_ = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { od, do_ };
}

export async function GET(req: NextRequest) {
  const sp       = new URL(req.url).searchParams;
  const period   = sp.get('period')  || 'mjesecno';
  const tip      = sp.get('tip')     || 'odjel';
  const refDatum = sp.get('datum')   || undefined;

  const { od, do_ } = getPeriodRange(period, refDatum);

  const [unosi, odjeli, inzinjeri] = await Promise.all([
    queryCol('unosi', [
      where('datum', '>=', Timestamp.fromDate(od)),
      where('datum', '<=', Timestamp.fromDate(do_)),
      orderBy('datum', 'desc'),
    ]) as Promise<UnosRada[]>,
    getAll('odjeli')    as Promise<Odjel[]>,
    getAll('inzinjeri') as Promise<Inzinjer[]>,
  ]);

  if (tip === 'odjel') {
    const data = odjeli
      .sort((a, b) => a.broj.localeCompare(b.broj))
      .map((odjel) => {
        const ou      = unosi.filter((u) => u.odjelId === odjel.id);
        const doznake = ou.filter((u) => u.vrsta === 'DOZNAKA');
        const vlake   = ou.filter((u) => u.vrsta === 'VLAKA');

        const ukupnoHektara = doznake.reduce((s, u) => s + (u.hektari ?? 0), 0);
        const ukupnoStabala = doznake.reduce((s, u) => s + (u.brojStabala ?? 0), 0);
        const ukupnoKm      = vlake.reduce((s, u) => s + (u.kilometri ?? 0), 0);

        return {
          odjel,
          ukupnoHektara:  Math.round(ukupnoHektara * 100) / 100,
          ukupnoStabala,
          ukupnoKm:       Math.round(ukupnoKm * 100) / 100,
          preostalo:      Math.round(Math.max(odjel.povrsina - ukupnoHektara, 0) * 100) / 100,
          postotak:       Math.min(Math.round((ukupnoHektara / odjel.povrsina) * 10000) / 100, 100),
          brojUnosa:      ou.length,
        };
      });

    return NextResponse.json({ period, od, do_, tip, data });
  }

  // tip === 'inzinjer'
  const odMap = Object.fromEntries(odjeli.map((o) => [o.id, o]));

  const data = inzinjeri
    .sort((a, b) => {
      const oA = odMap[a.odjelId]?.broj ?? '';
      const oB = odMap[b.odjelId]?.broj ?? '';
      return oA.localeCompare(oB) || a.prezime.localeCompare(b.prezime);
    })
    .map((inz) => {
      const iu      = unosi.filter((u) => u.inzinjerId === inz.id);
      const doznake = iu.filter((u) => u.vrsta === 'DOZNAKA');
      const vlake   = iu.filter((u) => u.vrsta === 'VLAKA');

      return {
        inzinjer:      { ...inz, odjel: odMap[inz.odjelId] ?? null },
        ukupnoHektara: Math.round(doznake.reduce((s, u) => s + (u.hektari ?? 0), 0) * 100) / 100,
        ukupnoStabala: doznake.reduce((s, u) => s + (u.brojStabala ?? 0), 0),
        ukupnoKm:      Math.round(vlake.reduce((s, u) => s + (u.kilometri ?? 0), 0) * 100) / 100,
        brojUnosa:     iu.length,
      };
    });

  return NextResponse.json({ period, od, do_, tip, data });
}
