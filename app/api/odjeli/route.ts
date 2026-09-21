import { NextRequest, NextResponse } from 'next/server';
import { db, create, queryCol } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Odjel } from '@/lib/types';

export async function GET() {
  const [odjeli, inzinjeri, unosi] = await Promise.all([
    queryCol('odjeli', []),
    getDocs(collection(db, 'inzinjeri')),
    getDocs(collection(db, 'unosi')),
  ]);

  const result = (odjeli as Odjel[])
    .sort((a, b) => a.broj.localeCompare(b.broj))
    .map((o) => ({
      ...o,
      _count: {
        inzinjeri: inzinjeri.docs.filter((d) => d.data().odjelId === o.id).length,
        unosi:     unosi.docs.filter((d) => d.data().odjelId === o.id).length,
      },
    }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const odjel = await create('odjeli', {
    naziv:    body.naziv,
    broj:     body.broj,
    povrsina: parseFloat(body.povrsina),
  });
  return NextResponse.json(odjel, { status: 201 });
}
