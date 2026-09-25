import type { Session } from "@/lib/auth";
import type { IconName } from "@/components/Icon";

export interface NavItem {
  href: string;
  label: string;
  /** Kratki naziv za donju traku na mobitelu */
  short?: string;
  desc: string;
  icon: IconName;
}

const I = {
  pocetna: { href: "/", label: "Početna", desc: "Pregled mjeseca", icon: "home" },
  unos: { href: "/unos", label: "Unos rada", short: "Unos", desc: "Doznaka, vlaka, teren i odsustva", icon: "pencil" },
  unosUcinka: { href: "/unos-ucinka", label: "Unos učinka", short: "Učinak", desc: "Dnevni unos za sve projektante", icon: "users" },
  izvjestaji: { href: "/izvjestaji", label: "Izvještaji", desc: "Sedmično, mjesečno i godišnje", icon: "chart" },
  kalendar: { href: "/kalendar", label: "Kalendar", desc: "Aktivnosti po danima", icon: "calendar" },
  sihtarica: { href: "/sihtarica", label: "Šihtarica", desc: "Dani u mjesecu i godišnji odmor", icon: "sheet" },
  odjeli: { href: "/odjeli", label: "Odjeli", desc: "Odjeli i površine", icon: "map" },
  plan: { href: "/plan", label: "Plan sječe", desc: "Plan i realizacija po odjelima", icon: "tree" },
  planProjektant: { href: "/plan-projektant", label: "Plan/projektant", desc: "Godišnji cilj ha po projektantu", icon: "target" },
  realizacija: { href: "/realizacija", label: "Realizacija", desc: "Napredak realizacije plana", icon: "trend" },
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

export function navFor(ses: Pick<Session, "role" | "operater"> | null): RoleNav {
  if (ses?.role === "admin") {
    return {
      all: [I.pocetna, I.unosUcinka, I.izvjestaji, I.kalendar, I.sihtarica, I.odjeli, I.plan, I.planProjektant, I.realizacija, I.elaborat, I.statistika, I.pomocniRadnici, I.postavke],
      primary: [I.pocetna, I.unosUcinka, I.sihtarica, I.izvjestaji],
      cta: I.unosUcinka,
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
