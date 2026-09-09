"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBrief, IconGrid, IconList, IconPlus, IconSearch } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterButton, FilterPanel } from "@/components/ui/Filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { deleteBrief, useBriefs } from "@/lib/briefs-store";
import type { SavedBrief } from "@/lib/types";
import { BriefGrid } from "./BriefGrid";
import { BriefTable } from "./BriefTable";

type ViewMode = "table" | "cards";
const VIEW_KEY = "dossier.briefs.view";

function readView(): ViewMode {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards";
}

export function BriefsList() {
  const router = useRouter();
  const { briefs, loading, refresh } = useBriefs();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("cards");
  const [pending, setPending] = useState<SavedBrief | null>(null);
  const filtersId = useId();
  const filterCount = query.trim() ? 1 : 0;

  useEffect(() => {
    setView(readView());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return briefs;
    return briefs.filter((brief) => brief.title.toLowerCase().includes(q));
  }, [briefs, query]);

  function setMode(next: ViewMode) {
    setView(next);
    window.localStorage.setItem(VIEW_KEY, next);
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Briefs"
        count={briefs.length}
        countLabel={`${briefs.length} saved brief${briefs.length === 1 ? "" : "s"}`}
        actions={
          <>
            <FilterButton
              open={filtersOpen}
              activeCount={filterCount}
              controlsId={filtersId}
              onClick={() => setFiltersOpen((current) => !current)}
            />
            <Button
              icon={<IconPlus className="h-4 w-4" />}
              onClick={() => router.push("/briefs/new")}
            >
              New brief
            </Button>
          </>
        }
      />

      <FilterPanel id={filtersId} open={filtersOpen}>
        <SearchInput
          className="sm:max-w-sm"
          placeholder="Search briefs"
          value={query}
          onChange={setQuery}
        />
        <SegmentedControl
          value={view}
          onChange={setMode}
          options={[
            { value: "table", label: "Table", icon: <IconList className="h-4 w-4" /> },
            { value: "cards", label: "Cards", icon: <IconGrid className="h-4 w-4" /> },
          ]}
        />
      </FilterPanel>

      {loading ? (
        <p className="text-sm text-muted">Loading briefs…</p>
      ) : !briefs.length ? (
        <EmptyState
          icon={<IconBrief className="h-8 w-8" />}
          title="No briefs yet"
          description="Create a brief. It is saved automatically when the answer finishes."
          actions={
            <Button icon={<IconPlus className="h-4 w-4" />} onClick={() => router.push("/briefs/new")}>
              New brief
            </Button>
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={<IconSearch className="h-8 w-8" />}
          title="No matching briefs"
          description="Try another title, or clear the search."
        />
      ) : view === "table" ? (
        <BriefTable
          briefs={filtered}
          onOpen={(brief) => router.push(`/briefs/${brief.id}`)}
          onDelete={setPending}
        />
      ) : (
        <BriefGrid
          briefs={filtered}
          onOpen={(brief) => router.push(`/briefs/${brief.id}`)}
          onDelete={setPending}
        />
      )}

      <ConfirmDeleteModal
        open={Boolean(pending)}
        title="Delete brief?"
        name={pending?.title ?? ""}
        description="This will remove"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          void deleteBrief(pending.id).then(() => {
            setPending(null);
            void refresh();
          });
        }}
      />
    </div>
  );
}
