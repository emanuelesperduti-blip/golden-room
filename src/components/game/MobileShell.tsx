import { useEffect } from "react";
import { MobileNav } from "./MobileNav";
import { TopBar } from "./TopBar";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { useGameStore } from "@/lib/gameStore";

interface MobileShellProps {
  children: React.ReactNode;
  hideNav?: boolean;
  hideTopBar?: boolean;
}

export function MobileShell({ children, hideNav, hideTopBar }: MobileShellProps) {
  const theme = useGameStore((s) => s.theme);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    document.body.style.background = theme === "ocean" ? "oklch(0.13 0.06 245)" : "oklch(0.15 0.1 300)";

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", theme === "ocean" ? "#10243d" : "#2a1240");
    }
  }, [theme]);

  const ambientGlow =
    theme === "ocean"
      ? "radial-gradient(circle at 20% 20%, oklch(0.46 0.18 230 / 0.5), transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.42 0.14 200 / 0.45), transparent 50%)"
      : "radial-gradient(circle at 20% 20%, oklch(0.4 0.25 320 / 0.5), transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.4 0.25 280 / 0.5), transparent 50%)";

  return (
    <div className="flex min-h-screen w-full justify-center overflow-x-hidden bg-[var(--shell-bg)] transition-colors duration-300">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 hidden md:block"
        style={{ background: ambientGlow }}
      />

      <div
        className="relative z-10 flex w-full max-w-md flex-col overflow-x-hidden bg-game md:my-4 md:rounded-[2.5rem] md:border md:border-white/10"
        style={{ height: "100dvh" }}
      >
        <ConfettiBackdrop />

        {!hideTopBar && (
          <div className="relative z-50 shrink-0">
            <TopBar />
          </div>
        )}

        <div className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-full pb-28 pt-2">{children}</div>
        </div>

        <PwaInstallBanner />
        {!hideNav && <MobileNav />}
      </div>
    </div>
  );
}

function ConfettiBackdrop() {
  const theme = useGameStore((s) => s.theme);
  const colors =
    theme === "ocean"
      ? [
          "oklch(0.84 0.14 220)",
          "oklch(0.74 0.16 200)",
          "oklch(0.72 0.11 250)",
          "oklch(0.72 0.16 170)",
          "oklch(0.88 0.12 95)",
        ]
      : [
          "oklch(0.85 0.18 90)",
          "oklch(0.72 0.3 350)",
          "oklch(0.78 0.16 220)",
          "oklch(0.74 0.18 150)",
          "oklch(0.7 0.25 25)",
        ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-sm opacity-15"
          style={{
            left: `${(i * 8.1) % 100}%`,
            top: `${(i * 12.3) % 100}%`,
            width: 6 + ((i * 3) % 8),
            height: 6 + ((i * 3) % 8),
            background: colors[i % colors.length],
            transform: `rotate(${(i * 37) % 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}
