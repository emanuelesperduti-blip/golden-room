import React from "react";
import { useAdminStore } from "@/lib/adminStore";
import { useAuth } from "@/hooks/useAuth";
import { isAdminUser } from "@/lib/admin";
import { Wrench, Shield } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { maintenance } = useAdminStore();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const isMaintenanceActive = maintenance.isEnabled;
  const shouldBlock = isMaintenanceActive && !(maintenance.allowAdminAccess && isAdmin);

  if (shouldBlock) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[linear-gradient(180deg,#1a0b2e_0%,#0f0514_100%)] px-6 text-center">
        <div className="max-w-md w-full">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gold/10 border border-gold/20 shadow-[0_0_30px_rgba(245,180,0,0.15)]">
            <Wrench className="h-10 w-10 text-gold" />
          </div>
          
          <h1 className="text-3xl font-black text-white mb-4 tracking-tight">
            {maintenance.title || "Manutenzione in corso"}
          </h1>
          
          <p className="text-lg font-medium text-white/70 mb-8 leading-relaxed">
            {maintenance.message || "Stiamo lavorando per migliorare la tua esperienza. Torneremo online il prima possibile."}
          </p>
          
          {maintenance.estimatedReturnTime > Date.now() && (
            <div className="mb-8 rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">Ritorno previsto</p>
              <p className="text-xl font-black text-gold">
                {new Date(maintenance.estimatedReturnTime).toLocaleString("it-IT", {
                  day: "2-digit",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
          )}

          {isAdmin && (
            <div className="mt-8 p-4 rounded-2xl border border-gold/30 bg-gold/5">
              <div className="flex items-center justify-center gap-2 text-gold mb-3">
                <Shield className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-wider">Accesso Admin Rilevato</span>
              </div>
              <Link 
                to="/admin" 
                className="inline-block w-full rounded-xl bg-gold px-6 py-3 text-sm font-black text-purple-900 shadow-lg active:scale-95 transition-transform"
              >
                Entra nel Pannello Admin
              </Link>
            </div>
          )}
          
          <p className="mt-12 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
            Golden Room &copy; 2024
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
