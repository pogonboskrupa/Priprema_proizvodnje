import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inzinjerId = searchParams.get("inzinjerId");
  const odjelId = searchParams.get("odjelId");
  const od = searchParams.get("od");
  const do_ = searchParams.get("do");

  const unosi = await prisma.unosRada.findMany({
    where: {
      ...(inzinjerId ? { inzinjerId: parseInt(inzinjerId) } : {}),
      ...(odjelId ? { odjelId: parseInt(odjelId) } : {}),
      ...(od || do_
        ? {
            datum: {
              ...(od ? { gte: new Date(od) } : {}),
              ...(do_ ? { lte: new Date(do_) } : {}),
            },
          }
        : {}),
    },
    include: { inzinjer: true, odjel: true },
    orderBy: { datum: "desc" },
  });
  return NextResponse.json(unosi);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const unos = await prisma.unosRada.create({
    data: {
      datum: new Date(body.datum),
      vrsta: body.vrsta,
      inzinjerId: parseInt(body.inzinjerId),
      odjelId: parseInt(body.odjelId),
      brojStabala: body.vrsta === "DOZNAKA" ? parseInt(body.brojStabala) || null : null,
      hektari: body.vrsta === "DOZNAKA" ? parseFloat(body.hektari) || null : null,
      kilometri: body.vrsta === "VLAKA" ? parseFloat(body.kilometri) || null : null,
      napomena: body.napomena || null,
    },
    include: { inzinjer: true, odjel: true },
  });
  return NextResponse.json(unos, { status: 201 });
}
