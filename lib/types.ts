export type VrstaRada = "DOZNAKA" | "VLAKA";

export type PeriodIzvjestaja = "sedmicno" | "mjesecno" | "godisnje";

export interface UnosRadaForm {
  datum: string;
  vrsta: VrstaRada;
  inzinjerId: number;
  odjelId: number;
  brojStabala?: number;
  hektari?: number;
  kilometri?: number;
  napomena?: string;
}
