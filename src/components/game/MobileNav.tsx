import { Link, useLocation } from "@tanstack/react-router";
import { Home, Layers, Gift, Target, User, type LucideIcon } from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon; center?: boolean };

const items: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/lobby", label: "Lobby", icon: Layers },
  { to: "/reveal", label: "Reveal", icon: Gift, center: true },
  { to: "/missions", label: "Missioni", icon: Target },
  { to: "/profile", label: "Profilo", icon: User },
];

export function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <div
        data-tour="mobile-nav"
        className="pointer-events-auto mx-3 flex w-full max-w-md items-end justify-between gap-1 rounded-3xl border border-white/10 px-3 pb-3 pt-2 shadow-card-game backdrop-blur-xl"
        style={{ background: "linear-gradient(160deg, oklch(0.36 0.2 320) 0%, oklch(0.24 0.16 305) 100%)" }}
      >
        {items.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          const Icon = item.icon;

          if (item.center) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative -mt-8 flex flex-col items-center"
                aria-label={item.label}
              >
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-magenta-grad shadow-glow-magenta ring-4 ring-purple-deep">
                  <span className="absolute inset-1 rounded-full bg-gold-shine opacity-90" />
                  <Icon className="relative h-7 w-7 text-purple-deep" strokeWidth={3} />
                </span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gold">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center gap-1 py-2"
              aria-label={item.label}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${
                  active ? "bg-magenta-grad shadow-glow-magenta scale-105" : "bg-white/5"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-white" : "text-white/60"}`}
                  strokeWidth={2.5}
                />
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-gold" : "text-white/50"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
