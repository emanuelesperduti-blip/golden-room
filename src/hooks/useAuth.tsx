import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";

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

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  provider: "google" | "facebook" | "email" | "anonymous";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    getSupabase().then((sb) => {
      if (!sb) { setLoading(false); return; }
      sb.auth.getSession().then(({ data }: any) => {
        setSession(data.session ?? null);
        setLoading(false);
      });
      const { data: listener } = sb.auth.onAuthStateChange((_: any, s: Session | null) => {
        setSession(s);
      });
      unsub = () => listener?.subscription?.unsubscribe();
    });
    return () => { unsub?.(); };
  }, []);

  async function signInWithGoogle() {
    const sb = await getSupabase();
    if (!sb) return { error: "Supabase non configurato" };
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    return { error: error?.message };
  }

  async function signInWithFacebook() {
    const sb = await getSupabase();
    if (!sb) return { error: "Supabase non configurato" };
    const { error } = await sb.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: `${window.location.origin}/` },
    });
    return { error: error?.message };
  }

  async function signInWithEmail(email: string, password: string) {
    const sb = await getSupabase();
    if (!sb) return { error: "Supabase non configurato" };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }

  async function signUpWithEmail(email: string, password: string, name: string) {
    const sb = await getSupabase();
    if (!sb) return { error: "Supabase non configurato" };
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return { error: error?.message };
  }

  async function signOut() {
    const sb = await getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    setSession(null);
  }

  const user = sessionToUser(session);

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
