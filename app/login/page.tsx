"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getKorisnikByIme } from "@/lib/db";
import { saveSession, getSession } from "@/lib/auth";
import { VERSION } from "@/lib/version";

export default function LoginPage() {
  const router = useRouter();
  const [ime, setIme] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(false);
  const imeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ses = getSession();
    if (ses) router.replace("/");
  }, []);

  function addDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setErr("");
    if (next.length === 4) setTimeout(() => doLogin(next), 80);
  }

  function delDigit() { setPin((p) => p.slice(0, -1)); setErr(""); }

  async function doLogin(p: string = pin) {
    const nameTrimmed = ime.trim().toUpperCase();
    if (!nameTrimmed) { setErr("Unesi korisničko ime!"); setPin(""); return; }
    if (p.length < 4) { setErr("Unesi 4-cifreni PIN!"); return; }
    setSubmitting(true);
    const found = await getKorisnikByIme(nameTrimmed);
    setSubmitting(false);
    if (!found) { setErr("Korisnik nije pronađen!"); setPin(""); return; }
    if (p !== found.pin) { setErr("Pogrešan PIN!"); setPin(""); return; }
    saveSession(
      { userId: found.id, ime: found.ime, fullName: found.fullName, role: found.role, avatar: found.avatar },
      remember
    );
    router.replace("/");
  }

  const dots = Array.from({ length: 4 }, (_, i) => submitting ? true : pin.length > i);

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
        <div style={{ textAlign: "center", color: "#4a6657", fontSize: 12, marginBottom: 18 }}>
          Unesi ime i PIN
        </div>

        {/* Ime korisnika */}
        <div style={{ marginBottom: 14 }}>
          <input
            ref={imeRef}
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Korisničko ime..."
            value={ime}
            onChange={(e) => { setIme(e.target.value); setErr(""); setPin(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && pin.length === 4) doLogin(); }}
            style={{
              width: "100%", padding: "10px 12px", border: "2px solid",
              borderColor: ime.trim() ? "#26613e" : "#ccd8d0",
              borderRadius: 8, background: "#f6f9f7", fontSize: 15,
              fontWeight: 700, fontFamily: "inherit", outline: "none",
              color: "#1c2e22", boxSizing: "border-box",
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}
          />
        </div>

        {/* PIN točkice */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 6 }}>
          {dots.map((on, i) => (
            <span key={i} style={{
              width: 14, height: 14, borderRadius: "50%",
              border: `2px solid ${err ? "#b92b20" : submitting ? "#9ab0a2" : on ? "#26613e" : "#ccd8d0"}`,
              background: on ? (err ? "#b92b20" : submitting ? "#9ab0a2" : "#26613e") : "transparent",
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
            <button key={d} onClick={() => addDigit(d)} disabled={submitting} style={btnStyle}>
              {d}
            </button>
          ))}
          <button style={{ ...btnStyle, opacity: 0.3, cursor: "default" }} disabled />
          <button onClick={() => addDigit("0")} disabled={submitting} style={btnStyle}>0</button>
          <button onClick={delDigit} disabled={submitting} style={{ ...btnStyle, fontSize: 15, color: "#4a6657" }}>⌫</button>
        </div>

        {/* Zapamti me */}
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 7, marginTop: 12, fontSize: 12, color: "#4a6657", cursor: "pointer", userSelect: "none"
        }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: "#26613e", cursor: "pointer" }}
          />
          Zapamti me
        </label>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#9ab0a2", letterSpacing: ".04em" }}>
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
