"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getKorisnikByIme } from "@/lib/db";
import { saveSession, getSession } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { VERSION } from "@/lib/version";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
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
    try {
      const found = await getKorisnikByIme(nameTrimmed);
      setSubmitting(false);
      if (!found) { setErr("Korisnik nije pronađen!"); setPin(""); return; }
      if (p !== found.pin) { setErr("Pogrešan PIN!"); setPin(""); return; }
      saveSession(
        { userId: found.id, ime: found.ime, fullName: found.fullName, role: found.role, operater: found.operater ?? false, avatar: found.avatar },
        remember
      );
      refresh();
      router.replace("/");
    } catch {
      setSubmitting(false);
      setPin("");
      setErr("Greška pri prijavi. Provjeri internet ili Firebase postavke.");
    }
  }

  const dots = Array.from({ length: 4 }, (_, i) => submitting ? true : pin.length > i);

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 16, background: "var(--background)"
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
        boxShadow: "0 12px 48px rgba(0,0,0,.16)", padding: "28px 22px",
        width: "100%", maxWidth: 360
      }}>
        <div style={{ textAlign: "center", fontSize: 20, fontWeight: 700, color: "var(--brand)", marginBottom: 4 }}>
          🌲 Priprema Proizvodnje
        </div>
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>
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
              borderColor: ime.trim() ? "var(--brand)" : "var(--border)",
              borderRadius: 8, background: "var(--background)", fontSize: 15,
              fontWeight: 700, fontFamily: "inherit", outline: "none",
              color: "var(--foreground)", boxSizing: "border-box",
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}
          />
        </div>

        {/* PIN točkice */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 6 }}>
          {dots.map((on, i) => (
            <span key={i} style={{
              width: 14, height: 14, borderRadius: "50%",
              border: `2px solid ${err ? "#b92b20" : submitting ? "var(--text-muted)" : on ? "var(--brand)" : "var(--border)"}`,
              background: on ? (err ? "#b92b20" : submitting ? "var(--text-muted)" : "var(--brand)") : "transparent",
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
          <button onClick={delDigit} disabled={submitting} style={{ ...btnStyle, fontSize: 15, color: "var(--text-muted)" }}>⌫</button>
        </div>

        {/* Zapamti me */}
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 7, marginTop: 12, fontSize: 12, color: "var(--text-muted)", cursor: "pointer", userSelect: "none"
        }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: "var(--brand)", cursor: "pointer" }}
          />
          Zapamti me
        </label>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "var(--text-muted)", letterSpacing: ".04em" }}>
          v{VERSION}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "15px 8px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 18,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  userSelect: "none",
  color: "var(--foreground)",
};
