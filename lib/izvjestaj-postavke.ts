import type { Korisnik } from "@/lib/types";

/** Ispis projektanta samo u sedmičnom i mjesečnom izvještaju; prazno = iz profila */
export interface ProjektantUIzvjestaju {
  ime?: string;
  zvanje?: string;
}

export interface IzvjestajPostavke {
  firma: string[];
  primalac: string;
  sekcija: string;
  potpis: string;
  /** Ime i prezime projektanta podebljano u tabeli */
  imeBold: boolean;
  /** ID-evi korisnika redom; ko nije na listi ide na kraj, abecedno */
  redoslijed: string[];
  projektanti: Record<string, ProjektantUIzvjestaju>;
}

export const ZADANE_POSTAVKE: IzvjestajPostavke = {
  firma: ["ŠPD »UNSKO-SANSKE ŠUME« d.o.o.", "BOSANSKA KRUPA", "Sekcija pripreme proizvodnje", "Pogon gospodarenja za općinu Bosanska Krupa"],
  primalac: "N/r Hikmet Kurbegović, dipl.ing.šum.",
  sekcija: "Sekcija Bosanska Krupa",
  potpis: "VODEĆI PROJEKTANT :",
  imeBold: false,
  redoslijed: [],
  projektanti: {},
};

/**
 * Zadano zaglavlje za šumariju s tim nazivom; bez naziva (zadana šumarija) ostaje tekst za Bosansku Krupu.
 * "Pogon gospodarenja Cazin" → firma CAZIN, "Pogon gospodarenja za općinu Cazin", "Sekcija Cazin"; primalac se upisuje ručno.
 */
export function zadanePostavke(naziv?: string | null): IzvjestajPostavke {
  const n = naziv?.trim();
  if (!n) return ZADANE_POSTAVKE;
  const mjesto = n.replace(/^(Pogon gospodarenja|Šumarija)\s+/i, "").trim() || n;
  const pogon = /^Pogon gospodarenja/i.test(n);
  return {
    ...ZADANE_POSTAVKE,
    firma: [ZADANE_POSTAVKE.firma[0], mjesto.toUpperCase(), ZADANE_POSTAVKE.firma[2], pogon ? `Pogon gospodarenja za općinu ${mjesto}` : n],
    primalac: "",
    sekcija: `Sekcija ${mjesto}`,
  };
}

const str = (v: unknown, zadano: string) => (typeof v === "string" ? v : zadano);

/** Dokument iz baze može biti star ili djelimičan — svako polje pada na zadanu vrijednost */
export function saZadanim(raw: Record<string, unknown> | null | undefined, zadane: IzvjestajPostavke = ZADANE_POSTAVKE): IzvjestajPostavke {
  const r = raw ?? {};
  const projektanti: Record<string, ProjektantUIzvjestaju> = {};
  if (r.projektanti && typeof r.projektanti === "object") {
    for (const [id, v] of Object.entries(r.projektanti as Record<string, unknown>)) {
      const p = (v ?? {}) as Record<string, unknown>;
      projektanti[id] = { ime: str(p.ime, ""), zvanje: str(p.zvanje, "") };
    }
  }
  return {
    firma: Array.isArray(r.firma) ? r.firma.filter((l): l is string => typeof l === "string") : zadane.firma,
    primalac: str(r.primalac, zadane.primalac),
    sekcija: str(r.sekcija, zadane.sekcija),
    potpis: str(r.potpis, zadane.potpis),
    imeBold: r.imeBold === true,
    redoslijed: Array.isArray(r.redoslijed) ? r.redoslijed.filter((id): id is string => typeof id === "string") : [],
    projektanti,
  };
}

export function poredaj<T extends Pick<Korisnik, "id" | "fullName" | "ime">>(korisnici: readonly T[], redoslijed: readonly string[]): T[] {
  const pozicija = new Map(redoslijed.map((id, i) => [id, i]));
  return [...korisnici].sort((a, b) => {
    const pa = pozicija.get(a.id) ?? Infinity;
    const pb = pozicija.get(b.id) ?? Infinity;
    if (pa !== pb) return pa - pb;
    return (a.fullName || a.ime).localeCompare(b.fullName || b.ime, "bs");
  });
}

export const imeUIzvjestaju = (k: Pick<Korisnik, "id" | "fullName" | "ime">, p: IzvjestajPostavke) =>
  p.projektanti[k.id]?.ime?.trim() || k.fullName || k.ime;

export const zvanjeUIzvjestaju = (k: Pick<Korisnik, "id" | "title">, p: IzvjestajPostavke) =>
  p.projektanti[k.id]?.zvanje?.trim() || k.title || "";
