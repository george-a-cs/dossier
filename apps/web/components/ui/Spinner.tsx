import { cn } from "@/lib/cn";

export function Spinner({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-current border-r-transparent",
        size === "sm" && "h-3.5 w-3.5 border-2",
        size === "md" && "h-5 w-5 border-2",
        size === "lg" && "h-8 w-8 border-[3px]",
        className,
      )}
      aria-hidden="true"
    />
  );
}
