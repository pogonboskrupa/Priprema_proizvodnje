import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const odjeli = await prisma.odjel.findMany({
    include: { _count: { select: { inzinjeri: true, unosi: true } } },
    orderBy: { broj: "asc" },
  });
  return NextResponse.json(odjeli);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const odjel = await prisma.odjel.create({
    data: {
      naziv: body.naziv,
      broj: body.broj,
      povrsina: parseFloat(body.povrsina),
    },
  });
  return NextResponse.json(odjel, { status: 201 });
}
