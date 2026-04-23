import React, { useEffect, useState } from "react";
import { useAdminStore, type AdminNotification } from "@/lib/adminStore";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Info, AlertCircle, Zap } from "lucide-react";

export function AdminNotificationLayer() {
  const { getActiveNotifications, removeNotification } = useAdminStore();
  const [activeNotifs, setActiveNotifs] = useState<AdminNotification[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNotifs(getActiveNotifications());
    }, 1000);
    return () => clearInterval(interval);
  }, [getActiveNotifications]);

  const banners = activeNotifs.filter(n => n.type === "banner");
  const popups = activeNotifs.filter(n => n.type === "popup");
  const temporaries = activeNotifs.filter(n => n.type === "temporary");

  return (
    <>
      {/* Banners at the top */}
      <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center p-4 gap-2">
        <AnimatePresence>
          {banners.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="w-full max-w-md pointer-events-auto rounded-2xl border border-gold/30 bg-[linear-gradient(135deg,rgba(45,18,79,0.95),rgba(15,10,28,0.98))] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-start gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white">{notif.title}</p>
                <p className="text-xs font-medium text-white/70 mt-1 leading-relaxed">{notif.message}</p>
              </div>
              <button 
                onClick={() => removeNotification(notif.id)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/30"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Popups in the center */}
      <AnimatePresence>
        {popups.length > 0 && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-[32px] border border-gold/30 bg-[linear-gradient(155deg,rgba(45,18,79,0.98),rgba(15,10,28,1))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-center"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                <Zap className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">{popups[0].title}</h3>
              <p className="text-sm font-medium text-white/70 mb-6 leading-relaxed">{popups[0].message}</p>
              <button
                onClick={() => removeNotification(popups[0].id)}
                className="w-full rounded-2xl bg-gold py-3 text-sm font-black text-purple-900 shadow-lg active:scale-95 transition-transform"
              >
                Ho capito
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Temporary toasts at the bottom */}
      <div className="fixed bottom-24 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center p-4 gap-2">
        <AnimatePresence>
          {temporaries.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="pointer-events-auto rounded-full border border-white/10 bg-black/80 backdrop-blur-md px-4 py-2 shadow-lg flex items-center gap-2"
            >
              <Info className="h-3.5 w-3.5 text-gold" />
              <p className="text-[11px] font-bold text-white">{notif.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
