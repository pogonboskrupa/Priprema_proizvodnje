-- CreateTable
CREATE TABLE "Odjel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "naziv" TEXT NOT NULL,
    "broj" TEXT NOT NULL,
    "povrsina" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Inzinjer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ime" TEXT NOT NULL,
    "prezime" TEXT NOT NULL,
    "email" TEXT,
    "odjelId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inzinjer_odjelId_fkey" FOREIGN KEY ("odjelId") REFERENCES "Odjel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnosRada" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "datum" DATETIME NOT NULL,
    "vrsta" TEXT NOT NULL,
    "inzinjerId" INTEGER NOT NULL,
    "odjelId" INTEGER NOT NULL,
    "brojStabala" INTEGER,
    "hektari" REAL,
    "kilometri" REAL,
    "napomena" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UnosRada_inzinjerId_fkey" FOREIGN KEY ("inzinjerId") REFERENCES "Inzinjer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UnosRada_odjelId_fkey" FOREIGN KEY ("odjelId") REFERENCES "Odjel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Odjel_broj_key" ON "Odjel"("broj");

-- CreateIndex
CREATE UNIQUE INDEX "Inzinjer_email_key" ON "Inzinjer"("email");
