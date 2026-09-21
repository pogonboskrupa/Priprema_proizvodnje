// Firestore document IDs are strings
export type VrstaRada = 'DOZNAKA' | 'VLAKA';
export type PeriodIzvjestaja = 'sedmicno' | 'mjesecno' | 'godisnje';

export interface Odjel {
  id: string;
  naziv: string;
  broj: string;
  povrsina: number;
  createdAt: string;
  updatedAt: string;
  _count?: { inzinjeri: number; unosi: number };
}

export interface Inzinjer {
  id: string;
  ime: string;
  prezime: string;
  email: string | null;
  odjelId: string;
  createdAt: string;
  updatedAt: string;
  odjel?: Odjel;
}

export interface UnosRada {
  id: string;
  datum: string; // ISO string
  vrsta: VrstaRada;
  inzinjerId: string;
  odjelId: string;
  brojStabala?: number | null;
  hektari?: number | null;
  kilometri?: number | null;
  napomena?: string | null;
  createdAt: string;
  updatedAt: string;
  inzinjer?: Inzinjer;
  odjel?: Odjel;
}

export interface UnosRadaForm {
  datum: string;
  vrsta: VrstaRada;
  inzinjerId: string;
  odjelId: string;
  brojStabala?: number;
  hektari?: number;
  kilometri?: number;
  napomena?: string;
}
