// Globalno stanje mreže + broj Firestore upisa koji čekaju potvrdu servera.
// Nema React zavisnosti — koriste ga i firebase.ts i hooks.

export interface NetState {
  online: boolean;
  pending: number;
}

let state: NetState = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pending: 0,
};

type Listener = (s: NetState) => void;
const listeners = new Set<Listener>();

function emit() {
  const snap = { ...state };
  for (const cb of listeners) cb(snap);
}

if (typeof window !== "undefined") {
  window.addEventListener("online",  () => { state = { ...state, online: true };  emit(); });
  window.addEventListener("offline", () => { state = { ...state, online: false }; emit(); });
}

export function getNetState(): NetState { return { ...state }; }

export function onNetState(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function pendingStart(): void {
  state = { ...state, pending: state.pending + 1 };
  emit();
}

export function pendingDone(): void {
  state = { ...state, pending: Math.max(0, state.pending - 1) };
  emit();
}
