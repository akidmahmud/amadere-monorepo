import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "ghost" | "link";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// §5.13 — primary/ghost/link. "link" is the quiet "View All ›" style: no
// chrome, brand or muted text, sized like inline text rather than a button.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "h-10 px-[18px] rounded-sm bg-brand-500 text-white hover:bg-brand-600",
  ghost: "h-10 px-[18px] rounded-sm bg-transparent border border-border text-text hover:bg-surface-2",
  link: "text-brand-500 hover:underline p-0 h-auto",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-ui text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = "Button";
