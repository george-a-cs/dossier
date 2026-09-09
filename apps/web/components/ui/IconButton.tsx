import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type IconButtonTone = "default" | "danger";

const TONES: Record<IconButtonTone, string> = {
  default: "text-muted hover:bg-bg hover:text-ink",
  danger: "text-danger hover:bg-danger-soft hover:text-danger",
};

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    tone?: IconButtonTone;
  }
>(function IconButton(
  { label, tone = "default", className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
