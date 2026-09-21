import { NextRequest, NextResponse } from 'next/server';
import { update, remove } from '@/lib/firebase';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const odjel = await update('odjeli', id, {
    naziv:    body.naziv,
    broj:     body.broj,
    povrsina: parseFloat(body.povrsina),
  });
  return NextResponse.json(odjel);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await remove('odjeli', id);
  return NextResponse.json({ ok: true });
}
