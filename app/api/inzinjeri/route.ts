import { NextRequest, NextResponse } from 'next/server';
import { create, getAll, getById } from '@/lib/firebase';
import type { Inzinjer, Odjel } from '@/lib/types';

export async function GET() {
  const [inzinjeri, odjeli] = await Promise.all([
    getAll('inzinjeri') as Promise<Inzinjer[]>,
    getAll('odjeli')    as Promise<Odjel[]>,
  ]);

  const odjelMap = Object.fromEntries(odjeli.map((o) => [o.id, o]));

  const result = inzinjeri
    .map((i) => ({ ...i, odjel: odjelMap[i.odjelId] ?? null }))
    .sort((a, b) => {
      const oA = a.odjel?.broj ?? '';
      const oB = b.odjel?.broj ?? '';
      return oA.localeCompare(oB) || a.prezime.localeCompare(b.prezime);
    });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const inzinjer = await create('inzinjeri', {
    ime:     body.ime,
    prezime: body.prezime,
    email:   body.email || null,
    odjelId: body.odjelId, // string ID
  });
  const odjel = await getById('odjeli', body.odjelId);
  return NextResponse.json({ ...inzinjer, odjel }, { status: 201 });
}
