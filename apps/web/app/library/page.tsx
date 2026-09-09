import { Suspense } from "react";
import { LibraryView } from "@/components/library/LibraryView";

export default function LibraryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading library…</p>}>
      <LibraryView />
    </Suspense>
  );
}
