import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import confetti from "canvas-confetti";
import { ArrowLeft, Crown, Ticket, Zap, X } from "lucide-react";
import { MobileShell } from "@/components/game/MobileShell";
import shopTickets from "@/assets/shop-tickets.png";
import shopVault from "@/assets/shop-spark-vault.png";
import shopVip from "@/assets/shop-vip-pass.png";
import { useGameStore } from "@/lib/gameStore";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { useAudio } from "@/hooks/useAudio";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [{ title: "GameSpark — Shop" }],
  }),
  component: ShopPage,
});

interface PurchaseItem {
  id: string;
  name: string;
  description: string;
  price: string;
  priceNum: number;
  img: string;
  badge?: string;
  action: () => void;
}

const SPARK_ICON = "⚡";

// ── Purchase Confirmation Modal ──────────────────────────────
function PurchaseModal({
  item,
  currentSparks,
  canAfford,
  onConfirm,
  onCancel,
}: {
  item: PurchaseItem;
  currentSparks: number;
  canAfford: boolean;
  onConfirm: () => boolean;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"confirm" | "paying" | "done">("confirm");

  function handlePay() {
    if (!canAfford) return;
    setStep("paying");
    setTimeout(() => {
      const ok = onConfirm();
      setStep(ok ? "done" : "confirm");
    }, 700);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && step !== "paying") onCancel(); }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative w-full max-w-md rounded-t-3xl border-t border-white/15 bg-[oklch(0.18_0.08_300)] p-6 pb-10 shadow-2xl"
      >
        {step !== "paying" && step !== "done" && (
          <button
            onClick={onCancel}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {step === "confirm" && (
          <>
            <div className="mb-4 flex items-center gap-4">
              <img src={item.img} alt="" className="h-16 w-16 rounded-2xl" />
              <div>
                <h3 className="text-xl font-extrabold text-white">{item.name}</h3>
                <p className="text-sm text-white/60">{item.description}</p>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/70">Costo</span>
                <span className="text-2xl font-extrabold text-gold">{item.price}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-white/45">Saldo disponibile</span>
                <span className="font-extrabold text-white">{currentSparks.toLocaleString("it-IT")} {SPARK_ICON}</span>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-xs font-bold text-white/75">Usa i tuoi Spark per acquistare vantaggi e pacchetti nello shop.</p>
              {!canAfford && (
                <p className="mt-1 text-xs font-bold text-rose-300">Spark insufficienti per questo acquisto.</p>
              )}
            </div>

            <button
              onClick={handlePay}
              disabled={!canAfford}
              className="w-full rounded-2xl bg-gold-shine py-4 text-center text-base font-extrabold text-purple-deep shadow-button-gold active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Usa {item.price}
            </button>
            <p className="mt-3 text-center text-[10px] text-white/30">
              Prezzo espresso in Spark · Nessun addebito in euro
            </p>
          </>
        )}

        {step === "paying" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-14 w-14 rounded-full border-4 border-white/10 border-t-gold"
            />
            <p className="text-base font-bold text-white">Conferma acquisto in corso…</p>
            <p className="text-xs text-white/50">Sto aggiornando il tuo saldo</p>
          </div>
        )}

        {step === "done" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/20 text-5xl">
              ✅
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold text-white">Acquisto completato!</p>
              <p className="mt-1 text-sm text-emerald-300">{item.name} aggiunto al tuo account</p>
            </div>
            <button
              onClick={onCancel}
              className="rounded-2xl bg-gold-shine px-8 py-3 font-extrabold text-purple-deep shadow-button-gold"
            >
              Continua a giocare →
            </button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ShopPage() {
  const { sfx } = useAudio();
  const addTickets = useGameStore((s) => s.addTickets);
  const spendSparks = useGameStore((s) => s.spendSparks);
  const addPremiumReveals = useGameStore((s) => s.addPremiumReveals);
  const activateVip = useGameStore((s) => s.activateVip);
  const { vip, sparks } = useViewerGameState();

  const [pending, setPending] = useState<PurchaseItem | null>(null);
  const [toast, setToast]     = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function openModal(item: PurchaseItem) {
    sfx("tap");
    setPending(item);
  }

  function confirmPurchase() {
    if (!pending) return false;
    const ok = spendSparks(pending.priceNum);
    if (!ok) {
      showToast("⚠️ Spark insufficienti per completare l'acquisto");
      return false;
    }
    pending.action();
    sfx("purchase");
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#f5b400", "#ff3da6", "#7c3aed"],
    });
    showToast(`✅ ${pending.name} acquistato con successo!`);
    return true;
  }

  // ── Item definitions ────────────────────────────────────────
  const ticketItems: PurchaseItem[] = [
    { id: "t1", name: "5 Ticket",   description: "Entra in 5 partite di Bingo",   price: "40 Spark",  priceNum: 40,  img: shopTickets, action: () => addTickets(5) },
    { id: "t2", name: "15 Ticket",  description: "Ottimo per iniziare",            price: "115 Spark", priceNum: 115, img: shopTickets, badge: "POPOLARE",  action: () => addTickets(15) },
    { id: "t3", name: "20 Ticket",  description: "Il più scelto ogni giorno",      price: "150 Spark", priceNum: 150, img: shopTickets, badge: "BEST VALUE", action: () => addTickets(20) },
    { id: "t4", name: "40 Ticket",  description: "Scorte per una settimana",       price: "260 Spark", priceNum: 260, img: shopTickets, action: () => addTickets(40) },
    { id: "t5", name: "100 Ticket", description: "Per i giocatori seri",           price: "620 Spark", priceNum: 620, img: shopTickets, badge: "VIP",        action: () => addTickets(100) },
  ];

  const utilityItems: PurchaseItem[] = [
    { id: "u1", name: "1 Reveal Premium", description: "Una rivelazione premium extra", price: "55 Spark", priceNum: 55, img: shopVault, action: () => addPremiumReveals(1) },
    { id: "u2", name: "3 Reveal Premium", description: "Pacchetto standard", price: "150 Spark", priceNum: 150, img: shopVault, badge: "POPOLARE", action: () => addPremiumReveals(3) },
    { id: "u3", name: "10 Reveal Premium", description: "Il pacchetto più conveniente", price: "420 Spark", priceNum: 420, img: shopVault, badge: "BEST VALUE", action: () => addPremiumReveals(10) },
    { id: "u4", name: "Golden Boost", description: "+25 Ticket e 2 Reveal Premium", price: "240 Spark", priceNum: 240, img: shopVault, action: () => { addTickets(25); addPremiumReveals(2); } },
  ];

  const vipItems: PurchaseItem[] = [
    { id: "v7", name: "VIP 7 giorni", description: "+3 Reveal Premium · Room esclusive · Spark giornalieri extra", price: "320 Spark", priceNum: 320, img: shopVip, action: () => { activateVip(7); addPremiumReveals(3); } },
    { id: "v30", name: "VIP 30 giorni", description: "+10 Reveal Premium · Badge VIP · Accesso a tutte le room", price: "760 Spark", priceNum: 760, img: shopVip, badge: "SCELTO", action: () => { activateVip(30); addPremiumReveals(10); } },
    { id: "v90", name: "VIP 90 giorni", description: "+30 Reveal Premium · Tutto incluso · Risparmi il 40%", price: "1800 Spark", priceNum: 1800, img: shopVip, badge: "RISPARMIO", action: () => { activateVip(90); addPremiumReveals(30); } },
  ];

  const bundleItems: PurchaseItem[] = [
    { id: "b1", name: "Golden Starter", description: "10 Ticket + 1 Reveal Premium", price: "120 Spark", priceNum: 120, img: shopTickets, action: () => { addTickets(10); addPremiumReveals(1); } },
    { id: "b2", name: "VIP Bundle", description: "30 Ticket + 5 Reveal Premium + VIP 7gg", price: "560 Spark", priceNum: 560, img: shopVip, badge: "CONSIGLIATO", action: () => { addTickets(30); addPremiumReveals(5); activateVip(7); } },
    { id: "b3", name: "Mega Pack", description: "100 Ticket + 15 Reveal Premium + VIP 30gg", price: "1450 Spark", priceNum: 1450, img: shopVip, badge: "MIGLIORE", action: () => { addTickets(100); addPremiumReveals(15); activateVip(30); } },
  ];

  return (
    <MobileShell>
      {/* Purchase modal */}
      <AnimatePresence>
        {pending && (
          <PurchaseModal
            item={pending}
            currentSparks={sparks}
            canAfford={sparks >= pending.priceNum}
            onConfirm={confirmPurchase}
            onCancel={() => setPending(null)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <Link to="/">
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white active:scale-90">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-stroke-game text-2xl font-extrabold text-gold">Shop</h1>
          <p className="text-xs font-bold text-white/50">Shop interno in Spark</p>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mb-3 rounded-2xl border border-emerald-400/30 bg-emerald-900/30 px-4 py-2.5 text-center text-sm font-bold text-emerald-200"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIP status banner */}
      {vip ? (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold-shine/10 p-3">
          <Crown className="h-7 w-7 text-gold" />
          <div>
            <p className="text-sm font-extrabold text-gold">Sei VIP! 👑</p>
            <p className="text-xs text-white/50">Goditi i tuoi vantaggi esclusivi</p>
          </div>
        </div>
      ) : (
        <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-gold/40 bg-[linear-gradient(135deg,oklch(0.3_0.15_60/0.4),oklch(0.18_0.08_300/0.4))] p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">👑</span>
            <div>
              <p className="text-base font-extrabold text-gold">Diventa VIP</p>
              <p className="text-xs text-white/60">Reveal illimitati · Room esclusive · Spark extra ogni giorno</p>
            </div>
          </div>
        </div>
      )}

      {/* VIP Passes */}
      <Section label="VIP Pass" icon={<Crown className="h-4 w-4" />}>
        <div className="space-y-2">
          {vipItems.map((item, i) => (
            <ItemRow key={item.id} item={item} delay={i * 0.05} onBuy={() => openModal(item)} />
          ))}
        </div>
      </Section>

      {/* Ticket Bundles */}
      <Section label="Ticket" icon={<Ticket className="h-4 w-4" />}>
        <div className="space-y-2">
          {ticketItems.map((item, i) => (
            <ItemRow key={item.id} item={item} delay={i * 0.04} onBuy={() => openModal(item)} />
          ))}
        </div>
      </Section>

      {/* Utility */}
      <Section label="Utility" icon={<Zap className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2">
          {utilityItems.map((item, i) => (
            <ItemCard key={item.id} item={item} delay={i * 0.04} onBuy={() => openModal(item)} />
          ))}
        </div>
      </Section>

      {/* Bundles */}
      <Section label="Bundle Speciali" icon={<span>🎁</span>}>
        <div className="space-y-2">
          {bundleItems.map((item, i) => (
            <ItemRow key={item.id} item={item} delay={i * 0.05} onBuy={() => openModal(item)} />
          ))}
        </div>
      </Section>

      <p className="mt-4 mb-2 px-4 text-center text-[10px] text-white/30">
Tutti i prezzi dello shop sono espressi in Spark. I contenuti acquistati sono virtuali e usabili nell'app.
      </p>
    </MobileShell>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-5 px-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
        <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-white/70">
          {icon} {label}
        </div>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
      </div>
      {children}
    </section>
  );
}

function ItemCard({ item, delay, onBuy }: { item: PurchaseItem; delay: number; onBuy: () => void }) {
  return (
    <motion.button
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      whileTap={{ scale: 0.95 }}
      onClick={onBuy}
      className={`relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl border p-3 pt-4 text-center shadow-card-game ${
        item.badge === "BEST VALUE" || item.badge === "VIP"
          ? "border-gold/40 bg-[linear-gradient(135deg,oklch(0.28_0.12_60),oklch(0.18_0.08_300))]"
          : "border-white/15 bg-card-game"
      }`}
    >
      {item.badge && (
        <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
          item.badge === "BEST VALUE" ? "bg-gold-shine text-purple-deep"
          : item.badge === "VIP" ? "bg-magenta-grad text-white"
          : "bg-emerald-400/20 text-emerald-300"
        }`}>
          {item.badge}
        </span>
      )}
      <img src={item.img} alt="" className="h-12 w-12" />
      <div className="text-sm font-extrabold text-white">{item.name}</div>
      <div className="mt-1 w-full rounded-xl bg-gold-shine py-1.5 text-sm font-extrabold text-purple-deep shadow-button-gold">
        {item.price}
      </div>
    </motion.button>
  );
}

function ItemRow({ item, delay, onBuy }: { item: PurchaseItem; delay: number; onBuy: () => void }) {
  return (
    <motion.button
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      whileTap={{ scale: 0.98 }}
      onClick={onBuy}
      className={`relative w-full overflow-hidden rounded-2xl border p-4 text-left shadow-card-game ${
        item.badge === "SCELTO" || item.badge === "MIGLIORE" || item.badge === "CONSIGLIATO"
          ? "border-gold/50 bg-[linear-gradient(135deg,oklch(0.3_0.15_60/0.5),oklch(0.18_0.08_300/0.5))]"
          : "border-white/15 bg-card-game"
      }`}
    >
      {item.badge && (
        <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
          item.badge === "MIGLIORE" ? "bg-gold-shine text-purple-deep"
          : item.badge === "SCELTO" || item.badge === "CONSIGLIATO" ? "bg-magenta-grad text-white"
          : "bg-emerald-400/20 text-emerald-300"
        }`}>
          {item.badge}
        </span>
      )}
      <div className="flex items-center gap-3 pr-16">
        <img src={item.img} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-white">{item.name}</div>
          <div className="text-xs text-white/55">{item.description}</div>
        </div>
        <div className="shrink-0 rounded-xl bg-gold-shine px-3 py-2 text-sm font-extrabold text-purple-deep shadow-button-gold">
          {item.price}
        </div>
      </div>
    </motion.button>
  );
}
