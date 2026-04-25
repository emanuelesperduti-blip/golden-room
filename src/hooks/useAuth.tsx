import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useGameStore } from "@/lib/gameStore";

// Lazy import supabase to avoid crash if env vars missing
let _supabase: any = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    _supabase = supabase;
    return _supabase;
  } catch {
    return null;
  }
}

const LOCAL_USERS_KEY = "gamespark-local-auth-users";
const LOCAL_SESSION_KEY = "gamespark-local-auth-session";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  provider: "google" | "facebook" | "email" | "anonymous";
}

interface LocalAccount {
  id: string;
  email: string;
  password: string;
  name: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithFacebook: () => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: false,
  signInWithGoogle: async () => ({}),
  signInWithFacebook: async () => ({}),
  signInWithEmail: async () => ({}),
  signUpWithEmail: async () => ({}),
  signOut: async () => {},
});

function sessionToUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const u = session.user;
  const meta = u.user_metadata ?? {};
  const provider = (u.app_metadata?.provider ?? "email") as AuthUser["provider"];
  return {
    id: u.id,
    email: u.email ?? null,
    name: meta.full_name ?? meta.name ?? meta.user_name ?? null,
    avatar_url: meta.avatar_url ?? meta.picture ?? null,
    provider,
  };
}

function localAccountToUser(account: LocalAccount | null): AuthUser | null {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    avatar_url: account.avatar_url,
    provider: "email",
  };
}

function readLocalAccounts(): LocalAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: LocalAccount[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(accounts));
}

function readLocalSession(): LocalAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.email) return null;
    return parsed as LocalAccount;
  } catch {
    return null;
  }
}

function writeLocalSession(account: LocalAccount | null) {
  if (typeof window === "undefined") return;
  if (!account) {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(account));
}

async function sendCustomConfirmationEmail(email: string, name: string) {
  if (typeof window === "undefined") return;
  const endpoint = window.localStorage.getItem("gamespark-sendgrid-function-url") || "";
  if (!endpoint.trim()) return;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name,
        redirectTo: window.location.origin + "/auth",
        fromEmail: window.localStorage.getItem("gamespark-sendgrid-from-email") || "noreply@gamespark.app",
        fromName: window.localStorage.getItem("gamespark-sendgrid-from-name") || "Golden Room",
        templateId: window.localStorage.getItem("gamespark-sendgrid-template-id") || undefined,
        sendGridApiKey: window.localStorage.getItem("gamespark-sendgrid-api-key") || undefined,
      }),
    });
  } catch (e) {
    console.warn("SendGrid confirmation email not sent", e);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [localUser, setLocalUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseEnabled, setSupabaseEnabled] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    getSupabase().then((sb) => {
      if (cancelled) return;

      if (!sb) {
        setSupabaseEnabled(false);
        setLocalUser(localAccountToUser(readLocalSession()));
        setLoading(false);
        return;
      }

      setSupabaseEnabled(true);
      try {
        sb.auth.getSession().then(({ data }: any) => {
          if (cancelled) return;
          setSession(data.session ?? null);
          setLoading(false);
        }).catch((e: any) => {
          console.error("Auth session error:", e);
          setLoading(false);
        });
        
        const { data: listener } = sb.auth.onAuthStateChange((_: any, s: Session | null) => {
          setSession(s);
        });
        unsub = () => listener?.subscription?.unsubscribe();
      } catch (e) {
        console.error("Auth bootstrap error:", e);
        setLoading(false);
      }
    }).catch((e) => {
      console.error("Supabase init error:", e);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  async function signInWithGoogle() {
    try {
      const sb = await getSupabase();
      if (!sb) return { error: "Accesso Google disponibile quando colleghi Supabase." };
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      return { error: error?.message };
    } catch (e: any) {
      return { error: e.message || "Errore durante l'accesso con Google." };
    }
  }

  async function signInWithFacebook() {
    try {
      const sb = await getSupabase();
      if (!sb) return { error: "Accesso Facebook disponibile quando colleghi Supabase." };
      const { error } = await sb.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo: `${window.location.origin}/` },
      });
      return { error: error?.message };
    } catch (e: any) {
      return { error: e.message || "Errore durante l'accesso con Facebook." };
    }
  }

  async function signInWithEmail(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    try {
      const sb = await getSupabase();
      if (sb) {
        const { error } = await sb.auth.signInWithPassword({ email: normalizedEmail, password: normalizedPassword });
        return { error: error?.message };
      }
    } catch (e: any) {
      return { error: e.message || "Errore durante l'accesso." };
    }

    const account = readLocalAccounts().find((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (!account || account.password !== normalizedPassword) {
      return { error: "Email o password non corretti." };
    }

    writeLocalSession(account);
    setLocalUser(localAccountToUser(account));
    setLoading(false);
    return {};
  }

  async function signUpWithEmail(email: string, password: string, name: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedName = name.trim();
    try {
      const sb = await getSupabase();
      if (sb) {
        const { error } = await sb.auth.signUp({
          email: normalizedEmail,
          password: normalizedPassword,
          options: {
            data: { full_name: normalizedName },
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/auth" : undefined,
          },
        });
        if (!error) {
          useGameStore.getState().resetForNewUser(normalizedName);
          void sendCustomConfirmationEmail(normalizedEmail, normalizedName);
        }
        return { error: error?.message };
      }
    } catch (e: any) {
      return { error: e.message || "Errore durante la registrazione." };
    }

    if (!normalizedName) return { error: "Inserisci un nome valido." };
    if (!normalizedEmail.includes("@")) return { error: "Inserisci un'email valida." };
    if (normalizedPassword.length < 6) return { error: "La password deve avere almeno 6 caratteri." };

    const accounts = readLocalAccounts();
    if (accounts.some((entry) => entry.email.toLowerCase() === normalizedEmail)) {
      return { error: "Esiste già un account con questa email." };
    }

    const account: LocalAccount = {
      id: `local-${Math.random().toString(36).slice(2, 10)}`,
      email: normalizedEmail,
      password: normalizedPassword,
      name: normalizedName,
      avatar_url: null,
    };

    writeLocalAccounts([...accounts, account]);
    writeLocalSession(account);
    useGameStore.getState().resetForNewUser(normalizedName);
    setLocalUser(localAccountToUser(account));
    setLoading(false);
    return {};
  }

  async function signOut() {
    try {
      const sb = await getSupabase();
      if (sb) {
        await sb.auth.signOut();
        setSession(null);
        return;
      }
    } catch (e) {
      console.error("Sign out error:", e);
    }
    writeLocalSession(null);
    setLocalUser(null);
  }

  const user = supabaseEnabled ? sessionToUser(session) : localUser;

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
