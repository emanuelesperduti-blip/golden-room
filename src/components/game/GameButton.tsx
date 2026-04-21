import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "magenta" | "gold" | "cyan" | "ghost";

interface GameButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: Variant;
  size?: "sm" | "md" | "lg" | "xl";
  glow?: boolean;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  magenta:
    "bg-magenta-grad text-white text-stroke-thin shadow-button-game border border-white/20",
  gold: "bg-gold-shine text-purple-deep shadow-button-gold border border-white/40",
  cyan:
    "border border-white/25 text-white text-stroke-thin shadow-button-game bg-[linear-gradient(135deg,oklch(0.7_0.18_220),oklch(0.5_0.18_240))]",
  ghost: "bg-white/10 text-white border border-white/20",
};

const sizes = {
  sm: "h-9 px-4 text-sm rounded-xl",
  md: "h-11 px-5 text-base rounded-2xl",
  lg: "h-14 px-7 text-lg rounded-2xl",
  xl: "h-16 px-8 text-xl rounded-3xl",
};

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(
  ({ variant = "magenta", size = "lg", glow, block, className, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ y: 4, scale: 0.98 }}
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-wide font-display select-none",
          "before:absolute before:inset-x-2 before:top-1 before:h-1/3 before:rounded-full before:bg-white/30 before:blur-[1px]",
          variants[variant],
          sizes[size],
          block && "w-full",
          glow && variant === "magenta" && "shadow-glow-magenta",
          glow && variant === "gold" && "shadow-glow-gold",
          className,
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-2">{children as React.ReactNode}</span>
      </motion.button>
    );
  },
);
GameButton.displayName = "GameButton";
