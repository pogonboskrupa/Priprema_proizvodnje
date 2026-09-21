import { NextRequest, NextResponse } from 'next/server';
import { remove } from '@/lib/firebase';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await remove('unosi', id);
  return NextResponse.json({ ok: true });
}
