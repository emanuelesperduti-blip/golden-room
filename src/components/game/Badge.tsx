import { cn } from "@/lib/utils";

type Variant = "vip" | "hot" | "free" | "new" | "live" | "gold";

const variants: Record<Variant, string> = {
  vip: "bg-gold-shine text-purple-deep border border-white/40",
  hot: "bg-[linear-gradient(135deg,oklch(0.7_0.25_25),oklch(0.55_0.25_15))] text-white border border-white/30",
  free: "bg-[linear-gradient(135deg,oklch(0.74_0.18_150),oklch(0.55_0.18_160))] text-white border border-white/30",
  new: "bg-[linear-gradient(135deg,oklch(0.78_0.16_220),oklch(0.55_0.18_240))] text-white border border-white/30",
  live: "bg-[linear-gradient(135deg,oklch(0.7_0.25_25),oklch(0.55_0.25_15))] text-white border border-white/30",
  gold: "bg-gold-shine text-purple-deep border border-white/40",
};

export function Badge({
  variant = "new",
  children,
  pulse,
  className,
}: {
  variant?: Variant;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shadow-inset-glow",
        variants[variant],
        className,
      )}
    >
      {variant === "live" && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse !== false && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
      )}
      {children}
    </span>
  );
}
