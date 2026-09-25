import { initializeApp, getApps, getApp } from 'firebase/app';
import { pendingStart, pendingDone } from './netStatus';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  getDocsFromCache,
  getDocsFromServer,
  getDocFromCache,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  Query,
  CollectionReference,
  onSnapshot,
  limit,
  runTransaction,
  arrayUnion,
  arrayRemove,
  getCountFromServer,
  type DocumentChange,
  type Unsubscribe,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function initDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // initializeFirestore throws if called twice on same app instance
    return getFirestore(app);
  }
}

export const db = initDb();

// Tiha anonimna prijava — Firestore security rules zahtijevaju request.auth != null
// Korisnik mora omogućiti Anonymous auth u Firebase Console > Authentication
let _authReady: Promise<void>;
if (typeof window !== 'undefined') {
  const auth = getAuth(getApps()[0] ?? initializeApp(firebaseConfig));
  const authPromise = new Promise<void>((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).then(() => resolve()).catch(() => resolve());
      } else {
        resolve();
      }
    });
  });
  // Ne blokiraj više od 4s — pri slabom signalu nastavi s cache-om
  _authReady = Promise.race([
    authPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 4000)),
  ]);
} else {
  _authReady = Promise.resolve();
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

// ── Sinhronizacija cache-a ────────────────────────────────────────────────────
// Čitanja idu iz lokalnog cache-a (brzo, radi i offline). Listeneri ga drže svježim.
// Male kolekcije se prate cijele. Unosi zavise od uloge (UnosiScope):
//  - admin/operater: nedavno mijenjani unosi + provjera broja otkriva nepotpun cache
//  - projektant: samo vlastiti unosi — tuđi podaci ne stižu na njegov uređaj

const SYNC_TIMEOUT_MS = 5000;
const UNOSI_PROZOR_DANA = 60;
const syncReady = new Map<string, Promise<void>>();
export interface UnosiChangeMeta {
  /** Prva serverska slika nakon offline starta — sadrži sve što je stiglo, nisu "novi" unosi */
  initialSync: boolean;
}
type UnosiSubscriber = (changes: DocumentChange<DocumentData>[], meta: UnosiChangeMeta) => void;
const unosiSubscribers = new Set<UnosiSubscriber>();

/** Promjene unosa (lokalni upis, drugi tab ili server) nakon početnog učitavanja */
export function onUnosiChanges(cb: UnosiSubscriber): () => void {
  unosiSubscribers.add(cb);
  return () => { unosiSubscribers.delete(cb); };
}

interface Listener { ready: Promise<void>; stop: () => void }

// ready se rješava na prvi snapshot sa servera, odmah ako je uređaj offline, ili nakon timeouta.
// Od tada promjene idu pretplatnicima — i offline, da se upis u drugom tabu/stranici vidi odmah.
function listen(q: Query<DocumentData>, opts: { keep: boolean; onLaterChanges?: UnosiSubscriber }): Listener {
  let unsub: Unsubscribe | null = null;
  const ready = new Promise<void>((resolve) => {
    let serverSynced = false;
    let live = false;
    const timer = setTimeout(() => { live = true; resolve(); }, isOffline() ? 0 : SYNC_TIMEOUT_MS);
    unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      let initialSync = false;
      if (!serverSynced && !snap.metadata.fromCache) {
        serverSynced = true;
        clearTimeout(timer);
        resolve();
        if (!opts.keep) { unsub?.(); return; }
        // online start: prva slika je početno stanje, nije promjena
        if (!live) { live = true; return; }
        initialSync = true;
      }
      if (!live) return;
      const changes = snap.docChanges();
      if (changes.length) opts.onLaterChanges?.(changes, { initialSync });
    }, () => { clearTimeout(timer); live = true; resolve(); });
  });
  return { ready, stop: () => unsub?.() };
}

async function ensureCompleteUnosi(isActive: () => boolean) {
  if (isOffline()) return;
  try {
    const ref = collection(db, 'unosi');
    const [server, cached] = await Promise.all([
      getCountFromServer(ref),
      getDocsFromCache(ref).catch(() => null),
    ]);
    if (!isActive() || (cached && cached.size === server.data().count)) return;
    // listener (ne jednokratni get) uklanja i dokumente obrisane na drugim uređajima
    await listen(ref, { keep: false }).ready;
  } catch { /* bez mreže — ostaje cache */ }
}

export type UnosiScope = { kind: 'all' } | { kind: 'own'; ids: string[] };

let scopeKey: string | null = null;
let resolveFirstScope: (s: Promise<UnosiScope>) => void = () => {};
let scopePromise: Promise<UnosiScope> = new Promise((r) => { resolveFirstScope = (s) => r(s); });
let stopUnosiSync: () => void = () => {};

/** Koje unose ovaj uređaj smije vidjeti; čeka dok AuthProvider ne postavi sesiju */
export function unosiScope(): Promise<UnosiScope> {
  return scopePromise;
}

// Stariji unosi su vezani za inzinjeri.id pa ulaze u projektantov skup ID-eva
async function ownIds(userId: string): Promise<string[]> {
  await ready('inzinjeri');
  const q = query(collection(db, 'inzinjeri'), where('korisnikId', '==', userId));
  const snap = await getDocsFromCache(q).catch(() => null);
  // Firestore "in" podržava do 30 vrijednosti
  return [userId, ...(snap?.docs.map((d) => d.id) ?? [])].slice(0, 30);
}

export function configureUnosiScope(userId: string, sviPodaci: boolean) {
  if (typeof window === 'undefined') return;
  const key = sviPodaci ? 'all' : `own:${userId}`;
  if (key === scopeKey) return;
  scopeKey = key;
  stopUnosiSync();

  const scope: Promise<UnosiScope> = sviPodaci
    ? Promise.resolve({ kind: 'all' })
    : ownIds(userId).then((ids) => ({ kind: 'own', ids }));
  resolveFirstScope(scope);
  scopePromise = scope;

  let active = true;
  const listeners: Listener[] = [];
  stopUnosiSync = () => { active = false; listeners.forEach((l) => l.stop()); };
  const notify: UnosiSubscriber = (changes, meta) => unosiSubscribers.forEach((cb) => cb(changes, meta));

  syncReady.set('unosi', _authReady.then(() => scope).then(async (sc) => {
    if (!active) return;
    if (sc.kind === 'own') {
      const l = listen(query(collection(db, 'unosi'), where('inzinjerId', 'in', sc.ids)), { keep: true, onLaterChanges: notify });
      listeners.push(l);
      await l.ready;
      return;
    }
    const since = Timestamp.fromMillis(Date.now() - UNOSI_PROZOR_DANA * 86_400_000);
    const l = listen(query(collection(db, 'unosi'), where('updatedAt', '>=', since)), { keep: true, onLaterChanges: notify });
    listeners.push(l);
    await l.ready;
    await ensureCompleteUnosi(() => active);
  }));
}

if (typeof window !== 'undefined') {
  for (const col of ['odjeli', 'users', 'inzinjeri']) {
    syncReady.set(col, _authReady.then(() => listen(collection(db, col), { keep: true }).ready));
  }
}

async function ready(col: string) {
  await _authReady;
  // neuspjela sinhronizacija ne smije blokirati čitanje — tada ostaje cache/server
  await syncReady.get(col)?.catch(() => undefined);
}

// Offline Firestore upiše lokalno i pošalje kad bude mreže, ali promise čeka server.
// Da UI ne visi na "Čuvanje...", nakon kratkog čekanja upis se smatra prihvaćenim.
// pendingStart/Done prate broj upisa koji čekaju potvrdu — koristi OfflineBanner.
function confirmOrQueue(write: Promise<void>): Promise<void> {
  pendingStart();
  write
    .then(() => pendingDone(true))
    .catch((e) => { console.error('Firestore upis odbijen', e); pendingDone(false); });
  const wait = isOffline() ? 300 : 10000;
  return Promise.race([write, new Promise<void>((r) => setTimeout(r, wait))]);
}

// ── helpers ───────────────────────────────────────────────────────────────────

export function docToObj(snap: QueryDocumentSnapshot<DocumentData>) {
  const data = snap.data();
  // convert Firestore Timestamps to ISO strings
  const out: Record<string, unknown> = { id: snap.id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  }
  return out;
}

export async function getAll(col: string) {
  await ready(col);
  const ref = collection(db, col);
  try {
    const cached = await getDocsFromCache(ref);
    if (!cached.empty) return cached.docs.map(docToObj);
  } catch { /* cache miss — nastavi na server */ }
  const snaps = await getDocs(ref);
  return snaps.docs.map(docToObj);
}

// Server-first; offline pada na cache umjesto da baci grešku
async function serverFirst(q: Query<DocumentData>) {
  await _authReady;
  try {
    return (await getDocsFromServer(q)).docs.map(docToObj);
  } catch {
    return (await getDocsFromCache(q)).docs.map(docToObj);
  }
}

export async function getAllFresh(col: string) {
  return serverFirst(collection(db, col));
}

export async function queryColFresh(col: string, constraints: Parameters<typeof query>[1][]) {
  return serverFirst(query(collection(db, col), ...constraints));
}

export async function getById(col: string, id: string) {
  await ready(col);
  const ref = doc(db, col, id);
  try {
    const cached = await getDocFromCache(ref);
    if (cached.exists()) return docToObj(cached as QueryDocumentSnapshot<DocumentData>);
  } catch { /* cache miss */ }
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return docToObj(snap as QueryDocumentSnapshot<DocumentData>);
}

export async function create(col: string, data: Record<string, unknown>) {
  await _authReady;
  // isti timestamp: createdAt === updatedAt znači "nikad editovan" (koristi Nav obavještenje)
  const now = Timestamp.now();
  const ref = doc(collection(db, col));
  await confirmOrQueue(setDoc(ref, { ...data, createdAt: now, updatedAt: now }));
  return getById(col, ref.id);
}

export async function update(col: string, id: string, data: Record<string, unknown>) {
  await _authReady;
  await confirmOrQueue(updateDoc(doc(db, col, id), { ...data, updatedAt: Timestamp.now() }));
  return getById(col, id);
}

export async function remove(col: string, id: string) {
  await _authReady;
  await confirmOrQueue(deleteDoc(doc(db, col, id)));
}

export async function queryCol(
  col: string,
  constraints: Parameters<typeof query>[1][]
) {
  await ready(col);
  const ref = collection(db, col) as CollectionReference<DocumentData>;
  const q: Query<DocumentData> = constraints.length
    ? query(ref, ...constraints)
    : ref;
  try {
    const cached = await getDocsFromCache(q);
    if (!cached.empty) return cached.docs.map(docToObj);
  } catch { /* cache miss */ }
  const snaps = await getDocs(q);
  return snaps.docs.map(docToObj);
}

/** Samo iz lokalnog cache-a (bez servera) — za unose ograničene na projektanta */
export async function queryColCache(col: string, constraints: Parameters<typeof query>[1][]) {
  await ready(col);
  const snap = await getDocsFromCache(query(collection(db, col), ...constraints)).catch(() => null);
  return snap ? snap.docs.map(docToObj) : [];
}

export function authReady() {
  return _authReady;
}

export { collection, doc, query, where, orderBy, Timestamp, onSnapshot, limit, runTransaction, arrayUnion, arrayRemove };
