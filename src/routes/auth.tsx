import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Chrome } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import heroOrb from "@/assets/hero-orb.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Golden Room — Accedi" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) void navigate({ to: "/" });
  }, [user, navigate]);

  async function handleEmail() {
    setError(null);
    setLoading(true);
    if (mode === "login") {
      const { error: err } = await signInWithEmail(email, password);
      if (err) setError(err);
      else void navigate({ to: "/" });
    } else {
      if (!name.trim()) { setError("Inserisci il tuo nome"); setLoading(false); return; }
      const { error: err } = await signUpWithEmail(email, password, name);
      if (err) setError(err);
      else setSuccess("Account creato! Controlla l'email per confermare.");
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const { error: err } = await signInWithGoogle();
    if (err) { setError(err); setLoading(false); }
    // On success, redirected via OAuth
  }

  async function handleFacebook() {
    setError(null);
    setLoading(true);
    const { error: err } = await signInWithFacebook();
    if (err) { setError(err); setLoading(false); }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[oklch(0.12_0.08_300)]"
         style={{ background: "radial-gradient(ellipse at 30% 20%, oklch(0.35 0.25 320 / 0.5), transparent 50%), radial-gradient(ellipse at 70% 80%, oklch(0.35 0.2 280 / 0.4), transparent 50%), oklch(0.12 0.08 300)" }}>

      <div className="relative w-full max-w-sm px-4 py-8">
        {/* Back to guest mode */}
        <Link to="/" className="mb-6 flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white/80 transition">
          <ArrowLeft className="h-4 w-4" /> Continua come ospite
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <motion.img
            src={heroOrb} alt="" className="mx-auto h-20 w-20"
            animate={{ y: [0, -6, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <h1 className="mt-4 text-stroke-game text-3xl font-extrabold text-gold">Golden Room</h1>
          <p className="mt-1 text-sm font-bold text-white/60">
            {mode === "login" ? "Bentornato! Accedi al tuo account" : "Crea il tuo account gratuito"}
          </p>
        </div>

        {/* Main card */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-white/15 bg-[oklch(0.18_0.08_300/0.9)] p-6 shadow-card-game backdrop-blur-xl"
        >
          {/* Social buttons */}
          <div className="space-y-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleGoogle}
              disabled={loading}
              className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/20 bg-white py-3.5 font-bold text-gray-800 shadow-lg transition active:opacity-90 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continua con Google
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleFacebook}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-[#1877F2] py-3.5 font-bold text-white shadow-lg transition active:opacity-90 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="white" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continua con Facebook
            </motion.button>
          </div>

          <div className="relative my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/15" />
            <span className="text-xs font-bold text-white/40">oppure</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>

          {/* Name field (register only) */}
          <AnimatePresence>
            {mode === "register" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-3 overflow-hidden"
              >
                <label className="mb-1 block text-xs font-bold text-white/60">Nome</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Il tuo nome"
                    className="h-12 w-full rounded-2xl border border-white/15 bg-black/40 pl-10 pr-4 text-sm font-bold text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-bold text-white/60">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                placeholder="la-tua@email.com"
                className="h-12 w-full rounded-2xl border border-white/15 bg-black/40 pl-10 pr-4 text-sm font-bold text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-bold text-white/60">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                placeholder="••••••••"
                className="h-12 w-full rounded-2xl border border-white/15 bg-black/40 pl-10 pr-11 text-sm font-bold text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
              />
              <button
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error / success */}
          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mb-3 rounded-xl bg-red-900/30 px-3 py-2 text-center text-xs font-bold text-red-300">
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mb-3 rounded-xl bg-emerald-900/30 px-3 py-2 text-center text-xs font-bold text-emerald-300">
                {success}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleEmail}
            disabled={loading || !email || !password}
            className="w-full rounded-2xl bg-gold-shine py-3.5 text-center font-extrabold text-purple-deep shadow-button-gold transition active:opacity-90 disabled:opacity-50"
          >
            {loading ? "Caricamento…" : mode === "login" ? "Accedi" : "Crea account"}
          </motion.button>

          {/* Toggle mode */}
          <p className="mt-4 text-center text-xs font-bold text-white/50">
            {mode === "login" ? "Non hai un account? " : "Hai già un account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setSuccess(null); }}
              className="text-gold underline underline-offset-2"
            >
              {mode === "login" ? "Registrati gratis" : "Accedi"}
            </button>
          </p>
        </motion.div>

        <p className="mt-4 text-center text-[10px] text-white/30">
          Accedendo accetti i Termini di Servizio e la Privacy Policy di Golden Room.
        </p>
      </div>
    </div>
  );
}
