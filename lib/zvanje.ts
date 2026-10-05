import type { Korisnik, VrstaSuma } from "@/lib/types";

export const ZVANJE_SUMA: Record<VrstaSuma, string> = {
  visoke: "Projektant u visokim šumama",
  izdanacke: "Projektant u izdanačkim šumama",
};

/** Zvanje za šihtaricu i obrasce; dok admin ne izabere vrstu šuma, ostaje upisana titula */
export function zvanje(k: Pick<Korisnik, "suma" | "title">): string {
  return k.suma ? ZVANJE_SUMA[k.suma] : k.title;
}
