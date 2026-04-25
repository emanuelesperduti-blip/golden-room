import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type TourStep = {
  title: string;
  body: string;
  target?: string;
};

type TourContextValue = {
  startTour: () => void;
};

type BubblePosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  arrowSide: 'top' | 'bottom' | 'none';
  arrowLeft: number;
};

const TOUR_STORAGE_KEY = 'gamespark-onboarding-seen-v1';
const TOUR_HIDE_STORAGE_KEY = 'gamespark-onboarding-hide-v1';
const TourContext = createContext<TourContextValue>({
  startTour: () => {},
});

const TOUR_STEPS: Record<string, TourStep[]> = {
  '/': [
    {
      title: 'Benvenuto',
      body: 'Ti mostro in pochi step le funzioni chiave dell’app.',
    },
    {
      title: 'Token e saldi',
      body: 'Qui controlli Spark e Ticket in tempo reale.',
      target: '[data-tour="topbar-wallet"]',
    },
    {
      title: 'Azioni principali',
      body: 'Da questa card entri subito nelle aree più importanti.',
      target: '[data-tour="home-hero"]',
    },
    {
      title: 'Lobby Bingo',
      body: 'Da qui raggiungi le sale e compri le cartelle.',
      target: '[data-tour="home-lobby-cta"]',
    },
    {
      title: 'Menu rapido',
      body: 'La barra in basso ti porta tra Home, Lobby, Reveal e Profilo.',
      target: '[data-tour="mobile-nav"]',
    },
  ],
  '/lobby': [
    {
      title: 'Lobby Bingo',
      body: 'Qui scegli la sala migliore per countdown, costo e premi.',
    },
    {
      title: 'Stato sale',
      body: 'Questo riepilogo mostra room in prevendita, live o in chiusura.',
      target: '[data-tour="lobby-summary"]',
    },
    {
      title: 'Lista room',
      body: 'Ogni card mostra giocatori, costo, reward e stato della sala.',
      target: '[data-tour="lobby-room-list"]',
    },
  ],
  '/bingo': [
    {
      title: 'Sala Bingo',
      body: 'Qui segui il round live e controlli le cartelle acquistate.',
    },
    {
      title: 'Numero live',
      body: 'La sfera centrale mostra il numero appena chiamato.',
      target: '[data-tour="bingo-live-ball"]',
    },
    {
      title: 'Numeri estratti',
      body: 'Qui vedi subito lo storico delle estrazioni del round.',
      target: '[data-tour="bingo-drawn-numbers"]',
    },
    {
      title: 'Cartella migliore',
      body: 'In alto compare sempre la cartella a cui mancano meno numeri.',
      target: '[data-tour="bingo-main-card"]',
    },
    {
      title: 'Tutte le cartelle',
      body: 'Qui apri la vista miniatura per confrontare tutte le cartelle.',
      target: '[data-tour="bingo-view-all-cards"]',
    },
  ],
  '/profile': [
    {
      title: 'Profilo',
      body: 'Qui controlli progressi, badge e info sul token Spark.',
    },
    {
      title: 'Statistiche',
      body: 'In questa griglia vedi Spark, Ticket e risultati di gioco.',
      target: '[data-tour="profile-stats"]',
    },
    {
      title: 'Spark token',
      body: 'Questa sezione mostra valore stimato pre-market e andamento progetto.',
      target: '[data-tour="profile-spark-token"]',
    },
  ],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBubblePosition(targetRect: DOMRect | null): BubblePosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isMobile = viewportWidth < 640;
  const sideMargin = isMobile ? 14 : 20;
  const width = Math.min(isMobile ? 272 : 300, viewportWidth - sideMargin * 2);
  const safeTop = isMobile ? 12 : 18;
  const safeBottom = isMobile ? 104 : 32;
  const gutter = isMobile ? 10 : 14;
  const bubbleHeightEstimate = isMobile ? 178 : 188;
  const maxHeight = Math.min(bubbleHeightEstimate, viewportHeight - safeTop - safeBottom);

  if (!targetRect) {
    return {
      top: clamp(24, safeTop, viewportHeight - maxHeight - safeBottom),
      left: clamp(sideMargin, sideMargin, viewportWidth - width - sideMargin),
      width,
      maxHeight,
      arrowSide: 'none',
      arrowLeft: 36,
    };
  }

  const preferredLeft = clamp(targetRect.left + targetRect.width / 2 - width / 2, sideMargin, viewportWidth - width - sideMargin);
  const arrowLeft = clamp(targetRect.left + targetRect.width / 2 - preferredLeft, 32, width - 32);
  const spaceBelow = viewportHeight - safeBottom - targetRect.bottom;
  const spaceAbove = targetRect.top - safeTop;

  if (spaceAbove >= maxHeight + gutter || spaceAbove > spaceBelow) {
    return {
      top: clamp(targetRect.top - maxHeight - gutter, safeTop, viewportHeight - maxHeight - safeBottom),
      left: preferredLeft,
      width,
      maxHeight,
      arrowSide: 'bottom',
      arrowLeft,
    };
  }

  return {
    top: clamp(targetRect.bottom + gutter, safeTop, viewportHeight - maxHeight - safeBottom),
    left: preferredLeft,
    width,
    maxHeight,
    arrowSide: 'top',
    arrowLeft,
  };
}

function BubbleArrow({ side, left }: { side: 'top' | 'bottom' | 'none'; left: number }) {
  if (side === 'none') return null;
  const sideClass = side === 'top' ? '-top-4' : '-bottom-4';
  const rotateClass = side === 'top' ? 'rotate-45' : 'rotate-[225deg]';

  return (
    <span
      className={`absolute ${sideClass} z-10 h-8 w-8 ${rotateClass} rounded-[6px] border-[3px] border-black bg-white shadow-[0_10px_20px_rgba(0,0,0,0.18)]`}
      style={{ left: left - 14 }}
    />
  );
}

export function AppTourProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [manualNonce, setManualNonce] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const steps = useMemo(() => TOUR_STEPS[pathname] ?? [], [pathname]);
  const currentStep = steps[stepIndex];

  const updateTargetRect = useCallback(() => {
    if (!currentStep?.target || typeof document === 'undefined') {
      setTargetRect(null);
      return;
    }
    const element = document.querySelector(currentStep.target) as HTMLElement | null;
    if (!element) {
      setTargetRect(null);
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    setTargetRect(element.getBoundingClientRect());
  }, [currentStep]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!steps.length) {
      setIsOpen(false);
      return;
    }

    const seen = window.localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    const hidden = window.localStorage.getItem(TOUR_HIDE_STORAGE_KEY) === 'true';
    if (!seen && !hidden && pathname === '/') {
      setStepIndex(0);
      setIsOpen(true);
    }
  }, [pathname, steps.length]);

  useEffect(() => {
    if (!isOpen) return;
    updateTargetRect();
    const onResize = () => updateTargetRect();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [isOpen, updateTargetRect, manualNonce]);

  const markSeen = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    if (dontShowAgain) window.localStorage.setItem(TOUR_HIDE_STORAGE_KEY, 'true');
  }, [dontShowAgain]);

  const closeTour = useCallback(() => {
    markSeen();
    setIsOpen(false);
    setTargetRect(null);
    setStepIndex(0);
  }, [markSeen]);

  const nextStep = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      closeTour();
      return;
    }
    setStepIndex((prev) => prev + 1);
    setManualNonce((prev) => prev + 1);
  }, [closeTour, stepIndex, steps.length]);

  const prevStep = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
    setManualNonce((prev) => prev + 1);
  }, []);

  const startTour = useCallback(() => {
    if (!steps.length) return;
    setDontShowAgain(false);
    setStepIndex(0);
    setIsOpen(true);
    setManualNonce((prev) => prev + 1);
  }, [steps.length]);

  const bubble = typeof window !== 'undefined'
    ? getBubblePosition(targetRect)
    : { top: 18, left: 12, width: 272, maxHeight: 188, arrowSide: 'none' as const, arrowLeft: 34 };

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      <AnimatePresence>
        {isOpen && currentStep && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-[rgba(5,1,16,0.72)]"
            />

            {targetRect && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="pointer-events-none fixed z-[121] rounded-[26px] border-2 border-gold/95 bg-transparent shadow-[0_0_0_9999px_rgba(4,1,15,0.55),0_0_0_2px_rgba(255,255,255,0.08)_inset,0_0_26px_rgba(245,180,0,0.22)]"
                style={{
                  top: targetRect.top - 6,
                  left: targetRect.left - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                }}
              />
            )}

            <motion.div
              key={`${pathname}-${stepIndex}`}
              initial={{ opacity: 0, y: 10, scale: 0.92, rotate: -2 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="fixed z-[122] overflow-visible rounded-[30px] border-[4px] border-black bg-[#fffdf8] text-slate-900 shadow-[0_16px_32px_rgba(0,0,0,0.28)]"
              style={{ top: bubble.top, left: bubble.left, width: bubble.width, maxHeight: bubble.maxHeight }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-[26px] [background-image:radial-gradient(rgba(0,0,0,0.10)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,246,255,0.96)_100%)] [background-size:10px_10px,100%_100%]" />
              <div className="pointer-events-none absolute inset-x-5 top-0 h-2 rounded-b-full bg-[linear-gradient(90deg,#ff4db8_0%,#ff8a00_52%,#ffd54a_100%)] opacity-85" />

              <div className="relative flex max-h-full flex-col px-4 pb-3 pt-4">
                <button
                  type="button"
                  onClick={closeTour}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-[#d8d9e6] bg-white text-slate-500 shadow-[0_6px_12px_rgba(15,23,42,0.08)]"
                  aria-label="Chiudi guida"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="pr-12">
                  <h3 className="max-w-[150px] text-[22px] font-black italic leading-[0.92] tracking-[-0.06em] text-[#121232] sm:max-w-none sm:text-[24px]">
                    {currentStep.title}
                  </h3>
                  <div className="mt-2 h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#ff49a1_0%,#ff8c2f_100%)]" />
                </div>

                <div className="mt-3 flex-1 overflow-y-auto pr-1">
                  <p className="text-[15px] font-bold leading-6 text-[#313459]">
                    {currentStep.body}
                  </p>
                </div>

                <div className="mt-3 border-t-[3px] border-[#e6e3ee] pt-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.06em] text-[#7b82a7]">
                      <input
                        type="checkbox"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                      Non mostrare più
                    </label>
                    <div className="text-[12px] font-black leading-4 text-[#7780a9]">
                      {stepIndex + 1} / {steps.length}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={closeTour}
                      className="rounded-[14px] border-[3px] border-[#7a44d4] bg-[linear-gradient(180deg,#9653ff_0%,#6f32d6_100%)] px-2 py-2 text-[12px] font-black uppercase tracking-[0.05em] text-white shadow-[0_6px_0_rgba(67,24,145,0.55)]"
                    >
                      Salta
                    </button>

                    <button
                      type="button"
                      onClick={prevStep}
                      disabled={stepIndex === 0}
                      className="inline-flex items-center justify-center gap-1 rounded-[14px] border-[3px] border-[#7a44d4] bg-[linear-gradient(180deg,#8b4ef1_0%,#6025cc_100%)] px-2 py-2 text-[12px] font-black uppercase tracking-[0.03em] text-white shadow-[0_6px_0_rgba(67,24,145,0.55)] disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Indietro</span>
                    </button>

                    <button
                      type="button"
                      onClick={nextStep}
                      className="inline-flex items-center justify-center gap-1 rounded-[14px] border-[3px] border-[#ffb85f] bg-[linear-gradient(180deg,#ffb62b_0%,#ff7f11_60%,#ff6500_100%)] px-2 py-2 text-[12px] font-black uppercase tracking-[0.03em] text-white shadow-[0_6px_0_rgba(165,64,0,0.55)]"
                    >
                      <span>{stepIndex === steps.length - 1 ? 'Fine' : 'Avanti'}</span>
                      {stepIndex !== steps.length - 1 && <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  );
}

export function useAppTour() {
  return useContext(TourContext);
}
