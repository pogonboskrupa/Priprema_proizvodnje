import type { Korisnik, UserRole } from './types';

const SESSION_KEY = 'ppnext_ses';

export interface Session {
  userId: string;
  ime: string;
  fullName: string;
  role: UserRole;
  avatar: string;
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(ses: Session, remember: boolean) {
  try {
    const str = JSON.stringify(ses);
    if (remember) {
      localStorage.setItem(SESSION_KEY, str);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, str);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function isAdmin(ses: Session | null): boolean {
  return ses?.role === 'admin';
}
