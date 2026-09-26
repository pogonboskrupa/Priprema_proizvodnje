import type { VrstaRada } from "@/lib/types";
import { parseCount, parseDecimal } from "@/lib/format";

export const NO_ODJEL_VRSTE: ReadonlySet<VrstaRada> = new Set<VrstaRada>(["TEREN", "GODISNJI", "KANCELARIJA", "BOLOVANJE"]);

export interface UnosEditForm {
  vrsta: VrstaRada;
  odjelId: string;
  brojStabala: string;
  hektari: string;
  kilometri: string;
  napomena: string;
}

export interface UnosEditPayload {
  vrsta: VrstaRada;
  odjelId: string | null;
  brojStabala: number | null;
  hektari: number | null;
  kilometri: number | null;
  napomena: string | null;
}

export const NEISPRAVAN_BROJ = "Neispravan broj.";

// Firestore odbija `undefined` vrijednosti, zato se sve prazno šalje kao null
export function editFormToPayload(f: UnosEditForm): { ok: true; data: UnosEditPayload } | { ok: false; error: string } {
  const needsOdjel = !NO_ODJEL_VRSTE.has(f.vrsta);
  if (needsOdjel && !f.odjelId) return { ok: false, error: "Odaberi odjel." };

  const brojStabala = f.vrsta === "DOZNAKA" ? parseCount(f.brojStabala) : null;
  const hektari = f.vrsta === "DOZNAKA" ? parseDecimal(f.hektari) : null;
  const kilometri = f.vrsta === "VLAKA" ? parseDecimal(f.kilometri) : null;
  if ([brojStabala, hektari, kilometri].some((n) => Number.isNaN(n))) {
    return { ok: false, error: NEISPRAVAN_BROJ };
  }
  // doznaka bez ha/stabala ili vlaka bez km tiho kvari statistiku — isto pravilo kao Unos rada
  if (f.vrsta === "DOZNAKA" && (brojStabala === null || hektari === null)) return { ok: false, error: "Upiši broj stabala i hektare." };
  if (f.vrsta === "VLAKA" && kilometri === null) return { ok: false, error: "Upiši kilometre." };

  return {
    ok: true,
    data: {
      vrsta: f.vrsta,
      odjelId: needsOdjel ? f.odjelId : null,
      brojStabala,
      hektari,
      kilometri,
      napomena: f.napomena.trim() || null,
    },
  };
}
