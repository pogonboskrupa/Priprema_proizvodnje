// Firestore document IDs are strings
export type VrstaRada = 'DOZNAKA' | 'VLAKA' | 'GODISNJI' | 'KANCELARIJA' | 'BOLOVANJE' | 'TEREN';
export type PeriodIzvjestaja = 'sedmicno' | 'mjesecno' | 'godisnje';
export type UserRole = 'admin' | 'worker';

export interface Korisnik {
  id: string;
  ime: string;
  fullName: string;
  title: string;
  pin: string;
  role: UserRole;
  operater?: boolean;
  avatar: string;
  odjeliIds: string[];
  odjeliRjesenjaIds?: string[];
  lastLoginAt?: string;
  arhiviran?: boolean;
  /** Godišnji plan doznake u ha, ključ je godina ("2026") */
  planHaPoGodini?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface Odjel {
  id: string;
  gj: string;   // gospodarska jedinica
  broj: string;
  povrsina: number;
  plan_cet: number;   // plan m³ četinara
  plan_lis: number;   // plan m³ lišćara
  real_cet: number;   // realizacija m³ četinara
  real_lis: number;   // realizacija m³ lišćara
  doznaceno?: boolean;
  vlakeProjektovane?: boolean;
  arhiviran?: boolean;
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
  korisnikId?: string | null;
  planHa?: number;
  rjesenje?: boolean;
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
  createdById?: string | null;
  createdByRole?: UserRole | null;
  updatedById?: string | null;
  updatedByRole?: UserRole | null;
  createdAt: string;
  updatedAt: string;
  inzinjer?: Inzinjer;
  korisnik?: Korisnik;
  creator?: Korisnik;
  updater?: Korisnik;
  odjel?: Odjel;
}

export interface UnosRadaForm {
  datum: string;
  vrsta: VrstaRada;
  inzinjerId: string;
  odjelId?: string;
  brojStabala?: number;
  hektari?: number;
  kilometri?: number;
  napomena?: string;
  createdById?: string;
  createdByRole?: UserRole;
}
