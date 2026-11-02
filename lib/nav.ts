import type { Session } from "@/lib/auth";
import type { IconName } from "@/components/Icon";

export interface NavItem {
  href: string;
  label: string;
  /** Kratki naziv za donju traku na mobitelu */
  short?: string;
  desc: string;
  icon: IconName;
  /** Dodatne putanje koje označavaju ovu stavku kao aktivnu (npr. podstranice) */
  match?: readonly string[];
}

const I = {
  pocetna: { href: "/", label: "Početna", desc: "Pregled mjeseca", icon: "home" },
  unos: { href: "/unos", label: "Unos rada", short: "Unos", desc: "Doznaka, vlaka, teren i odsustva", icon: "pencil" },
  unosUcinka: { href: "/unos-ucinka", label: "Unos učinka", short: "Učinak", desc: "Dnevni unos za sve projektante", icon: "users" },
  izvjestaji: { href: "/izvjestaji", label: "Izvještaji", desc: "Sedmično, mjesečno i godišnje", icon: "chart" },
  kalendar: { href: "/kalendar", label: "Kalendar", desc: "Aktivnosti po danima", icon: "calendar" },
  evidencijaRada: { href: "/kalendar", label: "Evidencija rada", short: "Evidencija", desc: "Kalendar i pomoćni radnici", icon: "calendar" },
  sihtarica: { href: "/sihtarica", label: "Šihtarica", desc: "Dani u mjesecu i godišnji odmor", icon: "sheet" },
  planDoznake: { href: "/odjeli", label: "Plan doznake", desc: "Odjeli, plan sječe i realizacija", icon: "tree", match: ["/plan", "/realizacija", "/odjel"] },
  elaborat: { href: "/elaborat", label: "Elaborat", desc: "Drvna masa i prirast po odsjecima", icon: "book" },
  statistika: { href: "/statistika", label: "Statistika", desc: "Prisutnost, učinak, usporedba", icon: "pie" },
  mojiOdjeli: { href: "/moji-odjeli", label: "Moji odjeli", desc: "Moji odjeli i rješenja", icon: "map" },
  pomocniRadnici: { href: "/pomocni-radnici", label: "Pomoćni radnici", short: "Radnici", desc: "Evidencija pomoćnih radnika", icon: "hardhat" },
  postavke: { href: "/postavke", label: "Postavke", desc: "Profil i PIN", icon: "gear" },
} satisfies Record<string, NavItem>;

export interface RoleNav {
  /** Redoslijed u gornjem meniju */
  all: NavItem[];
  /** Do 4 stavke u donjoj traci na mobitelu; ostalo ide u "Više" */
  primary: NavItem[];
  /** Glavna radnja za današnji dan (Početna) */
  cta: NavItem;
}

export function navFor(ses: Pick<Session, "role" | "operater" | "sihter" | "sumarijaId"> | null): RoleNav {
  // vodeći projektant šumarije (admin s šumarijom) vodi i vlastitu evidenciju rada
  if (ses?.role === "admin" && ses.sumarijaId) {
    return {
      all: [I.pocetna, I.unos, I.unosUcinka, I.izvjestaji, I.statistika, I.kalendar, I.sihtarica, I.planDoznake, I.elaborat, I.pomocniRadnici, I.postavke],
      primary: [I.pocetna, I.unos, I.unosUcinka, I.sihtarica],
      cta: I.unos,
    };
  }
  if (ses?.role === "admin") {
    return {
      // Šef sektora samo pregleda: nema vlastitu evidenciju ni unos za druge
      all: [I.pocetna, I.izvjestaji, I.statistika, I.kalendar, I.planDoznake, I.elaborat, I.postavke],
      primary: [I.pocetna, I.izvjestaji, I.statistika, I.planDoznake],
      cta: I.izvjestaji,
    };
  }
  if (ses?.sihter) {
    const base = [I.pocetna, I.unos, ...(ses.operater ? [I.unosUcinka] : []), I.izvjestaji, I.evidencijaRada, I.sihtarica, I.elaborat, I.mojiOdjeli, I.postavke];
    return {
      all: base,
      primary: [I.pocetna, I.unos, I.izvjestaji, I.evidencijaRada],
      cta: I.unos,
    };
  }
  const base = [I.pocetna, I.unos, ...(ses?.operater ? [I.unosUcinka] : []), I.izvjestaji, I.kalendar, I.sihtarica, I.elaborat, I.mojiOdjeli, ...(ses?.operater ? [I.pomocniRadnici] : []), I.postavke];
  return {
    all: base,
    primary: ses?.operater ? [I.pocetna, I.unos, I.unosUcinka, I.sihtarica] : [I.pocetna, I.unos, I.sihtarica, I.kalendar],
    cta: I.unos,
  };
}

export function isActive(path: string, href: string): boolean {
  const p = path.replace(/\/$/, "") || "/";
  return href === "/" ? p === "/" : p === href || p.startsWith(href + "/");
}

/** Stavka menija je aktivna na svojoj putanji i na putanjama iz `match` */
export const jeAktivna = (path: string, item: NavItem): boolean =>
  isActive(path, item.href) || !!item.match?.some((m) => isActive(path, m));
