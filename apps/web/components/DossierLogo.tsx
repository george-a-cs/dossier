import { cn } from "@/lib/cn";

type LogoSize = "md" | "lg";

const SIZES: Record<LogoSize, { mark: string; text: string; gap: string }> = {
  md: { mark: "h-7 w-7", text: "text-[22px]", gap: "gap-2" },
  lg: { mark: "h-9 w-9", text: "text-[28px]", gap: "gap-2.5" },
};

export function DossierMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="5" y="10" width="22" height="26" rx="5" fill="#05514a" />
      <rect x="10" y="6" width="22" height="26" rx="5" fill="#017e71" />
      <rect x="14" y="3" width="22" height="26" rx="5" fill="#029b8a" />
      <path
        d="M20 13h10M20 18h7"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DossierLogo({
  size = "md",
  className,
}: {
  size?: LogoSize;
  className?: string;
}) {
  const tokens = SIZES[size];
  return (
    <span className={cn("inline-flex items-center", tokens.gap, className)}>
      <DossierMark className={tokens.mark} />
      <span className={cn("font-semibold tracking-tight text-ink", tokens.text)}>
        dossier
      </span>
    </span>
  );
}
