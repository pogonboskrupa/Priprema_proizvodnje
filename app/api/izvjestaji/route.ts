import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getPeriodRange(period: string, datum?: string) {
  const now = datum ? new Date(datum) : new Date();

  if (period === "sedmicno") {
    const day = now.getDay() || 7;
    const od = new Date(now);
    od.setDate(now.getDate() - day + 1);
    od.setHours(0, 0, 0, 0);
    const do_ = new Date(od);
    do_.setDate(od.getDate() + 6);
    do_.setHours(23, 59, 59, 999);
    return { od, do_ };
  }

  if (period === "mjesecno") {
    const od = new Date(now.getFullYear(), now.getMonth(), 1);
    const do_ = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { od, do_ };
  }

  // godisnje
  const od = new Date(now.getFullYear(), 0, 1);
  const do_ = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { od, do_ };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "mjesecno";
  const tip = searchParams.get("tip") || "odjel"; // "odjel" | "inzinjer"
  const refDatum = searchParams.get("datum") || undefined;

  const { od, do_ } = getPeriodRange(period, refDatum);

  const unosi = await prisma.unosRada.findMany({
    where: { datum: { gte: od, lte: do_ } },
    include: { inzinjer: true, odjel: true },
  });

  if (tip === "odjel") {
    const odjeli = await prisma.odjel.findMany({ orderBy: { broj: "asc" } });

    const grouped = odjeli.map((odjel) => {
      const odjelUnosi = unosi.filter((u) => u.odjelId === odjel.id);
      const doznake = odjelUnosi.filter((u) => u.vrsta === "DOZNAKA");
      const vlake = odjelUnosi.filter((u) => u.vrsta === "VLAKA");

      const ukupnoHektara = doznake.reduce((s, u) => s + (u.hektari ?? 0), 0);
      const ukupnoStabala = doznake.reduce((s, u) => s + (u.brojStabala ?? 0), 0);
      const ukupnoKm = vlake.reduce((s, u) => s + (u.kilometri ?? 0), 0);
      const preostalo = odjel.povrsina - ukupnoHektara;

      return {
        odjel,
        ukupnoHektara: Math.round(ukupnoHektara * 100) / 100,
        ukupnoStabala,
        ukupnoKm: Math.round(ukupnoKm * 100) / 100,
        preostalo: Math.round(Math.max(preostalo, 0) * 100) / 100,
        postotak: Math.min(Math.round((ukupnoHektara / odjel.povrsina) * 10000) / 100, 100),
        brojUnosa: odjelUnosi.length,
      };
    });

    return NextResponse.json({ period, od, do_, tip, data: grouped });
  }

  // tip === "inzinjer"
  const inzinjeri = await prisma.inzinjer.findMany({
    include: { odjel: true },
    orderBy: [{ odjel: { broj: "asc" } }, { prezime: "asc" }],
  });

  const grouped = inzinjeri.map((inz) => {
    const inzUnosi = unosi.filter((u) => u.inzinjerId === inz.id);
    const doznake = inzUnosi.filter((u) => u.vrsta === "DOZNAKA");
    const vlake = inzUnosi.filter((u) => u.vrsta === "VLAKA");

    return {
      inzinjer: inz,
      ukupnoHektara: Math.round(doznake.reduce((s, u) => s + (u.hektari ?? 0), 0) * 100) / 100,
      ukupnoStabala: doznake.reduce((s, u) => s + (u.brojStabala ?? 0), 0),
      ukupnoKm: Math.round(vlake.reduce((s, u) => s + (u.kilometri ?? 0), 0) * 100) / 100,
      brojUnosa: inzUnosi.length,
    };
  });

  return NextResponse.json({ period, od, do_, tip, data: grouped });
}
