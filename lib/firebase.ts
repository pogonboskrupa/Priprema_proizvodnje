import { initializeApp, getApps, getApp } from 'firebase/app';
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
  addDoc,
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
  await _authReady;
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
  await _authReady;
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
  const ref = await addDoc(collection(db, col), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return getById(col, ref.id);
}

export async function update(col: string, id: string, data: Record<string, unknown>) {
  await _authReady;
  await updateDoc(doc(db, col, id), { ...data, updatedAt: Timestamp.now() });
  return getById(col, id);
}

export async function remove(col: string, id: string) {
  await _authReady;
  await deleteDoc(doc(db, col, id));
}

export async function queryCol(
  col: string,
  constraints: Parameters<typeof query>[1][]
) {
  await _authReady;
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

export { collection, query, where, orderBy, Timestamp, onSnapshot, limit };
