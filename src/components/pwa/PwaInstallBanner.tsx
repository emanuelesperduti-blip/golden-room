import { useEffect, useMemo, useState } from "react";
import { Download, Share, Smartphone, X, Chrome, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function PwaInstallBanner() {
  const { shouldShowBanner, canPromptInstall, install, dismiss, installMode } = usePwaInstall();
  const [installing, setInstalling] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!shouldShowBanner) {
      setShow(false);
      return;
    }
    const timer = window.setTimeout(() => setShow(true), 700);
    return () => window.clearTimeout(timer);
  }, [shouldShowBanner]);

  const copy = useMemo(() => {
    switch (installMode) {
      case "native":
        return {
          kicker: "Scarica la app",
          title: "Installa Golden Room sul telefono",
          body: "Accesso rapido dalla home, esperienza full screen e lobby più fluida.",
        };
      case "ios":
        return {
          kicker: "Aggiungi alla Home",
          title: "Installa Golden Room su iPhone",
          body: "Apri il menu Condividi di Safari e aggiungi la app alla schermata Home.",
        };
      case "android-manual":
        return {
          kicker: "Aggiungi alla Home",
          title: "Installa Golden Room da Chrome",
          body: "Se il popup non parte da solo, apri il menu ⋮ di Chrome e tocca “Installa app”.",
        };
      case "android-https":
        return {
          kicker: "Serve HTTPS",
          title: "Per installarla aprila da link sicuro",
          body: "Su Android l’installazione completa funziona da HTTPS o localhost. In locale via IP il banner resta solo informativo.",
        };
      default:
        return {
          kicker: "Golden Room",
          title: "Apri la app dalla Home",
          body: "Installa o aggiungi il collegamento per entrare più velocemente.",
        };
    }
  }, [installMode]);

  if (!shouldShowBanner || !show) return null;

  async function handleInstall() {
    if (!canPromptInstall) return;
    try {
      setInstalling(true);
      await install();
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    setShow(false);
    dismiss();
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        className="fixed inset-x-3 bottom-24 z-[120] mx-auto w-auto max-w-md"
      >
        <div className="relative overflow-hidden rounded-3xl border border-gold/35 bg-[linear-gradient(135deg,oklch(0.38_0.21_320/0.96),oklch(0.23_0.13_300/0.98))] p-4 shadow-[0_18px_48px_oklch(0.1_0.08_300/0.6)] backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold/20 blur-3xl" />
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 active:scale-95"
            aria-label="Chiudi banner installazione"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-shine text-purple-deep shadow-button-gold">
              {installMode === "android-https" ? <ShieldAlert className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold uppercase tracking-wide text-gold">{copy.kicker}</p>
              <h3 className="mt-0.5 text-lg font-extrabold text-white">{copy.title}</h3>
              <p className="mt-1 text-xs font-bold leading-relaxed text-white/70">{copy.body}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {installMode === "native" ? (
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={installing}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-shine px-4 py-3 text-sm font-extrabold text-purple-deep shadow-button-gold transition active:scale-[0.98] disabled:opacity-70"
              >
                <Download className="h-4 w-4" />
                {installing ? "Preparazione…" : "Installa ora"}
              </button>
            ) : null}

            {installMode === "ios" ? (
              <div className="rounded-2xl border border-white/12 bg-black/20 px-3 py-3 text-xs font-bold text-white/85">
                Su iPhone: tocca <Share className="mx-1 inline h-4 w-4 align-text-bottom" /> e poi <span className="text-gold">“Aggiungi a Home”</span>.
              </div>
            ) : null}

            {installMode === "android-manual" ? (
              <div className="rounded-2xl border border-white/12 bg-black/20 px-3 py-3 text-xs font-bold text-white/85">
                Su Android: apri <Chrome className="mx-1 inline h-4 w-4 align-text-bottom" /> il menu <span className="text-gold">⋮</span> e seleziona <span className="text-gold">“Installa app”</span> o <span className="text-gold">“Aggiungi a schermata Home”</span>.
              </div>
            ) : null}

            {installMode === "android-https" ? (
              <div className="rounded-2xl border border-white/12 bg-black/20 px-3 py-3 text-xs font-bold text-white/85">
                Questa schermata ti ricorda che la PWA è pronta, ma per l’installazione vera devi aprire il sito da un dominio <span className="text-gold">HTTPS</span>.
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
