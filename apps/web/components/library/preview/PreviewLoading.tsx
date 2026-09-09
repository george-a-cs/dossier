import { Spinner } from "@/components/ui/Spinner";

export function PreviewLoading({
  label = "Loading preview…",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4">
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary-soft" />
          <Spinner size="lg" className="relative text-primary" />
        </span>
        <p className="m-0 text-sm font-medium text-muted">{label}</p>
      </div>
    </div>
  );
}
