import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const odjel = await prisma.odjel.update({
    where: { id: parseInt(id) },
    data: {
      naziv: body.naziv,
      broj: body.broj,
      povrsina: parseFloat(body.povrsina),
    },
  });
  return NextResponse.json(odjel);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.odjel.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
