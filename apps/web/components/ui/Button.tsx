import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerSecondary";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-600 disabled:hover:bg-primary",
  secondary:
    "bg-surface text-ink ring-1 ring-line hover:bg-bg disabled:hover:bg-surface",
  ghost: "bg-transparent text-ink hover:bg-bg disabled:hover:bg-transparent",
  danger:
    "bg-danger text-white shadow-sm hover:bg-[#d63a2f] disabled:hover:bg-danger",
  dangerSecondary:
    "bg-surface text-danger ring-1 ring-danger hover:bg-danger-soft disabled:hover:bg-surface",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
}
