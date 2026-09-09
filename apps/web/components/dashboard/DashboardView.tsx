"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBrief, IconCheck, IconFile, IconSpark, IconUpload } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { UploadModal } from "@/components/library/UploadModal";
import { listQueryEvents } from "@/lib/api";
import { useBriefs } from "@/lib/briefs-store";
import type { QueryEvent } from "@/lib/types";
import { useDocuments } from "@/lib/use-documents";
import { ActivityFeed, buildActivity } from "./ActivityFeed";
import { StatCard } from "./StatCard";
import { UsageChart } from "./UsageChart";

const ACTIVITY_PREVIEW = 5;

export function DashboardView() {
  const router = useRouter();
  const { documents, loading, refresh } = useDocuments();
  const { briefs } = useBriefs();
  const [events, setEvents] = useState<QueryEvent[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    listQueryEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [briefs.length, documents.length]);

  const ready = documents.filter((doc) => doc.status === "ready").length;
  const grounded = briefs.filter((brief) =>
    brief.turns.some((turn) => turn.final && !turn.final.refused),
  ).length;
  const chartDates = [
    ...briefs.map((brief) => brief.updatedAt),
    ...events.map((event) => event.created_at),
  ];
  const activity = buildActivity(documents, briefs, events);

  return (
    <div className="min-w-0">
      <PageHeader
        title="Dashboard"
        tooltip="A snapshot of this dossier — files, briefs, and recent work."
        actions={
          <Button onClick={() => router.push("/briefs/new")}>New brief</Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted">Loading overview…</p>
      ) : null}

      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Files"
          value={documents.length}
          hint="In this collection"
          icon={<IconFile className="h-5 w-5" />}
        />
        <StatCard
          label="Ready"
          value={ready}
          hint="Indexed and searchable"
          icon={<IconCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Briefs"
          value={briefs.length}
          hint="Saved briefs"
          icon={<IconBrief className="h-5 w-5" />}
        />
        <StatCard
          label="Grounded"
          value={briefs.length ? `${Math.round((grounded / briefs.length) * 100)}%` : "—"}
          hint="Briefs with citations"
          icon={<IconSpark className="h-5 w-5" />}
        />
      </div>

      {!documents.length && !loading ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconUpload className="h-8 w-8" />}
            title="No files yet"
            description="Upload a PDF, Word, Excel, CSV, Markdown, text, or image file to start briefing."
            actions={
              <Button
                icon={<IconUpload className="h-4 w-4" />}
                onClick={() => setUploadOpen(true)}
              >
                Upload file
              </Button>
            }
          />
        </div>
      ) : null}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={refresh}
      />

      <Modal
        title="Activity"
        size="lg"
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
      >
        <ActivityFeed items={activity} />
      </Modal>

      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="mt-0 mb-1 text-base font-semibold">Briefing activity</h2>
          <p className="mt-0 mb-4 text-[13px] text-muted">Last 7 days</p>
          {chartDates.length ? (
            <UsageChart dates={chartDates} />
          ) : (
            <EmptyState
              embedded
              icon={<IconSpark className="h-8 w-8" />}
              title="No briefing activity"
              description="Ask a question to start the week."
            />
          )}
        </Card>
        <Card>
          <h2 className="mt-0 mb-4 text-base font-semibold">Activity</h2>
          <ActivityFeed items={activity.slice(0, ACTIVITY_PREVIEW)} />
          {activity.length > ACTIVITY_PREVIEW ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={() => setActivityOpen(true)}
            >
              View more
            </Button>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
