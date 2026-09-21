// Firestore document IDs are strings
export type VrstaRada = 'DOZNAKA' | 'VLAKA' | 'GODISNJI' | 'KANCELARIJA' | 'BOLOVANJE';
export type PeriodIzvjestaja = 'sedmicno' | 'mjesecno' | 'godisnje';
export type UserRole = 'admin' | 'worker';

export interface Korisnik {
  id: string;
  ime: string;         // korisničko ime (za login)
  fullName: string;    // puno ime i prezime
  title: string;       // radno mjesto
  pin: string;
  role: UserRole;
  avatar: string;
  odjeliIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Odjel {
  id: string;
  naziv: string;
  broj: string;
  povrsina: number;
  plan_cet: number;   // plan m³ četinara
  plan_lis: number;   // plan m³ lišćara
  real_cet: number;   // realizacija m³ četinara
  real_lis: number;   // realizacija m³ lišćara
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
