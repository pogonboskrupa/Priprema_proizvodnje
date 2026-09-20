import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const inzinjer = await prisma.inzinjer.update({
    where: { id: parseInt(id) },
    data: {
      ime: body.ime,
      prezime: body.prezime,
      email: body.email || null,
      odjelId: parseInt(body.odjelId),
    },
    include: { odjel: true },
  });
  return NextResponse.json(inzinjer);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.inzinjer.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
