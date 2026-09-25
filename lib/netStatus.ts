// Globalno stanje mreže + broj Firestore upisa koji čekaju potvrdu servera.
// Nema React zavisnosti — koriste ga i firebase.ts i hooks.

export interface NetState {
  online: boolean;
  pending: number;
  syncFailed: boolean; // imao upis koji je server odbio u tekućoj grupi
}

let state: NetState = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pending: 0,
  syncFailed: false,
};

type Listener = (s: NetState) => void;
const listeners = new Set<Listener>();

function emit() {
  const snap = { ...state };
  for (const cb of listeners) cb(snap);
}

// Guard: registruj listenere samo jednom po window instanci (HMR / hot reload)
if (typeof window !== "undefined" && !(window as unknown as Record<string, unknown>).__netStatusInit) {
  (window as unknown as Record<string, unknown>).__netStatusInit = true;
  window.addEventListener("online",  () => { state = { ...state, online: true };  emit(); });
  window.addEventListener("offline", () => { state = { ...state, online: false }; emit(); });
}

export function getNetState(): NetState { return { ...state }; }

export function onNetState(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function pendingStart(): void {
  if (typeof window === "undefined") return; // no-op na serveru
  // Pri prelasku 0→1 resetuj grešku prethodne grupe
  const fresh = state.pending === 0;
  state = { ...state, pending: state.pending + 1, syncFailed: fresh ? false : state.syncFailed };
  emit();
}

// ok=true: server potvrdio; ok=false: server odbio (permission error, network fail)
export function pendingDone(ok = true): void {
  if (typeof window === "undefined") return;
  state = {
    ...state,
    pending: Math.max(0, state.pending - 1),
    syncFailed: state.syncFailed || !ok,
  };
  emit();
}
