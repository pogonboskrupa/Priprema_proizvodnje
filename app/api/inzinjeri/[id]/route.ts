import { NextRequest, NextResponse } from 'next/server';
import { update, remove, getById } from '@/lib/firebase';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const inzinjer = await update('inzinjeri', id, {
    ime:     body.ime,
    prezime: body.prezime,
    email:   body.email || null,
    odjelId: body.odjelId,
  });
  const odjel = await getById('odjeli', body.odjelId);
  return NextResponse.json({ ...inzinjer, odjel });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await remove('inzinjeri', id);
  return NextResponse.json({ ok: true });
}
