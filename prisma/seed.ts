import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Odjeli
  const odjel1 = await prisma.odjel.upsert({
    where: { broj: "001" },
    update: {},
    create: { naziv: "Odjel Gornji lug", broj: "001", povrsina: 250.5 },
  });
  const odjel2 = await prisma.odjel.upsert({
    where: { broj: "002" },
    update: {},
    create: { naziv: "Odjel Bukova greda", broj: "002", povrsina: 180.0 },
  });
  const odjel3 = await prisma.odjel.upsert({
    where: { broj: "003" },
    update: {},
    create: { naziv: "Odjel Crna rijeka", broj: "003", povrsina: 320.75 },
  });

  // Inžinjeri
  const inz1 = await prisma.inzinjer.upsert({
    where: { email: "amir.hodza@example.com" },
    update: {},
    create: { ime: "Amir", prezime: "Hodžić", email: "amir.hodza@example.com", odjelId: odjel1.id },
  });
  const inz2 = await prisma.inzinjer.upsert({
    where: { email: "emir.basic@example.com" },
    update: {},
    create: { ime: "Emir", prezime: "Bašić", email: "emir.basic@example.com", odjelId: odjel1.id },
  });
  const inz3 = await prisma.inzinjer.upsert({
    where: { email: "sanel.kovac@example.com" },
    update: {},
    create: { ime: "Sanel", prezime: "Kovač", email: "sanel.kovac@example.com", odjelId: odjel2.id },
  });
  const inz4 = await prisma.inzinjer.upsert({
    where: { email: "tarik.mus@example.com" },
    update: {},
    create: { ime: "Tarik", prezime: "Mušović", email: "tarik.mus@example.com", odjelId: odjel3.id },
  });

  // Unosi rada – ovaj mjesec
  const now = new Date();
  const entries = [
    { datum: new Date(now.getFullYear(), now.getMonth(), 3), vrsta: "DOZNAKA", inzinjerId: inz1.id, odjelId: odjel1.id, brojStabala: 120, hektari: 15.5 },
    { datum: new Date(now.getFullYear(), now.getMonth(), 5), vrsta: "DOZNAKA", inzinjerId: inz1.id, odjelId: odjel1.id, brojStabala: 85, hektari: 10.0 },
    { datum: new Date(now.getFullYear(), now.getMonth(), 7), vrsta: "VLAKA", inzinjerId: inz2.id, odjelId: odjel1.id, kilometri: 3.2 },
    { datum: new Date(now.getFullYear(), now.getMonth(), 10), vrsta: "DOZNAKA", inzinjerId: inz3.id, odjelId: odjel2.id, brojStabala: 200, hektari: 25.0 },
    { datum: new Date(now.getFullYear(), now.getMonth(), 12), vrsta: "VLAKA", inzinjerId: inz3.id, odjelId: odjel2.id, kilometri: 1.8 },
    { datum: new Date(now.getFullYear(), now.getMonth(), 15), vrsta: "DOZNAKA", inzinjerId: inz4.id, odjelId: odjel3.id, brojStabala: 310, hektari: 40.0 },
    { datum: new Date(now.getFullYear(), now.getMonth(), 17), vrsta: "DOZNAKA", inzinjerId: inz2.id, odjelId: odjel1.id, brojStabala: 90, hektari: 12.0 },
  ];

  for (const e of entries) {
    await prisma.unosRada.create({ data: e });
  }

  console.log("Seed podaci uneseni.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
