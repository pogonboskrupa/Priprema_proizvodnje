import { NextRequest, NextResponse } from 'next/server';
import { db, create, getAll, getById, queryCol, Timestamp } from '@/lib/firebase';
import { query, collection, where, orderBy, getDocs } from 'firebase/firestore';
import type { UnosRada, Inzinjer, Odjel } from '@/lib/types';

async function joinUnosi(unosi: UnosRada[]) {
  const [inzinjeri, odjeli] = await Promise.all([
    getAll('inzinjeri') as Promise<Inzinjer[]>,
    getAll('odjeli')    as Promise<Odjel[]>,
  ]);
  const inzMap = Object.fromEntries(inzinjeri.map((i) => [i.id, i]));
  const odMap  = Object.fromEntries(odjeli.map((o) => [o.id, o]));
  return unosi.map((u) => ({
    ...u,
    inzinjer: inzMap[u.inzinjerId] ?? null,
    odjel:    odMap[u.odjelId]    ?? null,
  }));
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const inzinjerId = sp.get('inzinjerId');
  const odjelId    = sp.get('odjelId');
  const od         = sp.get('od');
  const do_        = sp.get('do');

  const constraints: Parameters<typeof query>[1][] = [];
  if (inzinjerId) constraints.push(where('inzinjerId', '==', inzinjerId));
  if (odjelId)    constraints.push(where('odjelId',    '==', odjelId));
  if (od)  constraints.push(where('datum', '>=', Timestamp.fromDate(new Date(od))));
  if (do_) constraints.push(where('datum', '<=', Timestamp.fromDate(new Date(do_))));
  constraints.push(orderBy('datum', 'desc'));

  const unosi = await queryCol('unosi', constraints) as UnosRada[];
  const result = await joinUnosi(unosi);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const isDoznaka = body.vrsta === 'DOZNAKA';
  const unos = await create('unosi', {
    datum:       Timestamp.fromDate(new Date(body.datum)),
    vrsta:       body.vrsta,
    inzinjerId:  body.inzinjerId,
    odjelId:     body.odjelId,
    brojStabala: isDoznaka ? (parseInt(body.brojStabala) || null) : null,
    hektari:     isDoznaka ? (parseFloat(body.hektari)   || null) : null,
    kilometri:  !isDoznaka ? (parseFloat(body.kilometri) || null) : null,
    napomena:    body.napomena || null,
  });
  const [inzinjer, odjel] = await Promise.all([
    getById('inzinjeri', body.inzinjerId),
    getById('odjeli',    body.odjelId),
  ]);
  return NextResponse.json({ ...unos, inzinjer, odjel }, { status: 201 });
}
