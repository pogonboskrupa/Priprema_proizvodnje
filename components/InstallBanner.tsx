"use client";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("pwa-install-dismissed")) return;
    } catch {}

    function handler(e: Event) {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt || dismissed) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setPrompt(null);
    }
    dismiss();
  }

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem("pwa-install-dismissed", "1"); } catch {}
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-green-700 text-white flex items-center gap-3 px-4 py-3 shadow-lg">
      <span className="text-lg flex-shrink-0">📲</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-tight">Instaliraj Priprema Proizvodnje</div>
        <div className="text-xs text-green-200 mt-0.5">Radi offline · brži pristup s početnog ekrana</div>
      </div>
      <button
        onClick={install}
        className="bg-white text-green-800 font-bold text-xs px-3 py-1.5 rounded flex-shrink-0 hover:bg-green-50"
      >
        Instaliraj
      </button>
      <button
        onClick={dismiss}
        className="text-white/70 hover:text-white text-lg px-1 flex-shrink-0"
        title="Zatvori"
      >
        ✕
      </button>
    </div>
  );
}
