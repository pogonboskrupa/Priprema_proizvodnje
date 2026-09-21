import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
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
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

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
  const snaps = await getDocs(collection(db, col));
  return snaps.docs.map(docToObj);
}

export async function getById(col: string, id: string) {
  const snap = await getDoc(doc(db, col, id));
  if (!snap.exists()) return null;
  return docToObj(snap as QueryDocumentSnapshot<DocumentData>);
}

export async function create(col: string, data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, col), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return getById(col, ref.id);
}

export async function update(col: string, id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: Timestamp.now() });
  return getById(col, id);
}

export async function remove(col: string, id: string) {
  await deleteDoc(doc(db, col, id));
}

export async function queryCol(
  col: string,
  constraints: Parameters<typeof query>[1][]
) {
  const ref = collection(db, col) as CollectionReference<DocumentData>;
  const q: Query<DocumentData> = constraints.length
    ? query(ref, ...constraints)
    : ref;
  const snaps = await getDocs(q);
  return snaps.docs.map(docToObj);
}

export { collection, query, where, orderBy, Timestamp };
