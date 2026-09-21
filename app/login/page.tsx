"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getKorisnici } from "@/lib/db";
import { saveSession, getSession } from "@/lib/auth";
import type { Korisnik } from "@/lib/types";
import { VERSION } from "@/lib/version";

export default function LoginPage() {
  const router = useRouter();
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [selected, setSelected] = useState<Korisnik | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(true);
  const nameRef = useRef<HTMLSelectElement>(null);

  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    const ses = getSession();
    if (ses) { router.replace(base + "/"); return; }
    getKorisnici().then((k) => { setKorisnici(k); setLoading(false); });
  }, []);

  function addDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setErr("");
    if (next.length === 4) setTimeout(() => doLogin(next), 80);
  }

  function delDigit() { setPin((p) => p.slice(0, -1)); setErr(""); }

  function doLogin(p: string = pin) {
    if (!selected) { setErr("Odaberi korisnika!"); return; }
    if (p.length < 4) { setErr("Unesi 4-cifreni PIN!"); return; }
    if (p !== selected.pin) {
      setErr("Pogrešan PIN!");
      setPin("");
      return;
    }
    saveSession(
      { userId: selected.id, ime: selected.ime, fullName: selected.fullName, role: selected.role, avatar: selected.avatar },
      remember
    );
    router.replace(base + "/");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#5e7a68", fontSize: 14 }}>Učitavam...</div>
      </div>
    );
  }

  const dots = Array.from({ length: 4 }, (_, i) => pin.length > i);

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 16, background: "var(--bg, #f0f4f1)"
    }}>
      <div style={{
        background: "#fff", border: "1px solid #ccd8d0", borderRadius: 18,
        boxShadow: "0 12px 48px rgba(0,0,0,.16)", padding: "28px 22px",
        width: "100%", maxWidth: 360
      }}>
        <div style={{ textAlign: "center", fontSize: 20, fontWeight: 700, color: "#26613e", marginBottom: 4 }}>
          🌲 Priprema Proizvodnje
        </div>
        <div style={{ textAlign: "center", color: "#5e7a68", fontSize: 12, marginBottom: 18 }}>
          Unesi ime i PIN
        </div>

        {/* Odabir korisnika */}
        <div style={{ marginBottom: 14 }}>
          <select
            ref={nameRef}
            value={selected?.id || ""}
            onChange={(e) => {
              const k = korisnici.find((x) => x.id === e.target.value) || null;
              setSelected(k); setPin(""); setErr("");
            }}
            style={{
              width: "100%", padding: "10px 12px", border: "2px solid #ccd8d0",
              borderRadius: 8, background: "#f6f9f7", fontSize: 14,
              fontWeight: 600, fontFamily: "inherit", outline: "none",
              color: selected ? "#1c2e22" : "#5e7a68",
              borderColor: selected ? "#26613e" : "#ccd8d0",
            }}
          >
            <option value="">Odaberi korisnika...</option>
            {korisnici.map((k) => (
              <option key={k.id} value={k.id}>{k.ime}</option>
            ))}
          </select>
        </div>

        {/* PIN točkice */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 6 }}>
          {dots.map((on, i) => (
            <span key={i} style={{
              width: 14, height: 14, borderRadius: "50%",
              border: `2px solid ${err ? "#b92b20" : on ? "#26613e" : "#ccd8d0"}`,
              background: on ? (err ? "#b92b20" : "#26613e") : "transparent",
              transition: "all .13s",
              display: "inline-block"
            }} />
          ))}
        </div>

        <div style={{ textAlign: "center", color: "#b92b20", fontSize: 12, minHeight: 18, marginBottom: 10 }}>
          {err}
        </div>

        {/* Numerička tipkovnica */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button key={d} onClick={() => addDigit(d)} style={btnStyle}>
              {d}
            </button>
          ))}
          <button style={{ ...btnStyle, opacity: 0.3, cursor: "default" }} disabled />
          <button onClick={() => addDigit("0")} style={btnStyle}>0</button>
          <button onClick={delDigit} style={{ ...btnStyle, fontSize: 15, color: "#5e7a68" }}>⌫</button>
        </div>

        {/* Zapamti me */}
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 7, marginTop: 12, fontSize: 12, color: "#5e7a68", cursor: "pointer", userSelect: "none"
        }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: "#26613e", cursor: "pointer" }}
          />
          Zapamti me
        </label>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#ccd8d0", letterSpacing: ".04em" }}>
          v{VERSION}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "15px 8px",
  background: "#f6f9f7",
  border: "1px solid #ccd8d0",
  borderRadius: 10,
  fontSize: 18,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  userSelect: "none",
};
