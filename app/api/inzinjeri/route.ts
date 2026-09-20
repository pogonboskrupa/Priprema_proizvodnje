import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const inzinjeri = await prisma.inzinjer.findMany({
    include: { odjel: true },
    orderBy: [{ odjel: { broj: "asc" } }, { prezime: "asc" }],
  });
  return NextResponse.json(inzinjeri);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const inzinjer = await prisma.inzinjer.create({
    data: {
      ime: body.ime,
      prezime: body.prezime,
      email: body.email || null,
      odjelId: parseInt(body.odjelId),
    },
    include: { odjel: true },
  });
  return NextResponse.json(inzinjer, { status: 201 });
}
