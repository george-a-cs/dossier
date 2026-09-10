"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBrief, IconFolder, IconSend, IconSpark, IconTrash } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tooltip } from "@/components/ui/Tooltip";
import { Textarea } from "@/components/ui/Textarea";
import { briefStream, getChunk, getDocument, stripCiteTrailer } from "@/lib/api";
import { uniqueFoundDocuments } from "@/lib/found-documents";
import { deleteBrief, deleteBriefTurn, getBrief, notifyBriefsChanged } from "@/lib/briefs-store";
import { formatDateTime, formatMoney, formatMs, formatWhen, truncate } from "@/lib/format";
import type { Citation, Document, SavedTurn } from "@/lib/types";
import { useDocuments } from "@/lib/use-documents";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { EditDocumentModal } from "@/components/library/EditDocumentModal";
import { FilePreview } from "@/components/library/FilePreview";
import { BriefProgressBadge, BriefThinkingCursor } from "./BriefProgressBadge";
import { DebugDrawer } from "./DebugDrawer";
import { FoundDocumentCta } from "./FoundDocumentCta";

const EXAMPLES = [
  "What is the recommended dose?",
  "Is there any X-ray related document?",
];

export function BriefComposer({ briefId }: { briefId?: string }) {
  const router = useRouter();
  const { documents, loading, refresh } = useDocuments();
  const ready = documents.some((doc) => doc.status === "ready");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<SavedTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(briefId ?? null);
  const [title, setTitle] = useState("New brief");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!briefId);
  const [missing, setMissing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingTurnDelete, setPendingTurnDelete] = useState<number | null>(null);
  const [deletingTurn, setDeletingTurn] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [previewChunkId, setPreviewChunkId] = useState<string | null>(null);
  const [previewQuery, setPreviewQuery] = useState<string | null>(null);
  const [editing, setEditing] = useState<Document | null>(null);
  const previewFile = documents.find((doc) => doc.id === previewDocId) ?? null;

  useEffect(() => {
    if (!briefId) return;
    let cancelled = false;
    void getBrief(briefId)
      .then((existing) => {
        if (cancelled) return;
        if (!existing) {
          setMissing(true);
          setHydrated(true);
          return;
        }
        setTurns(existing.turns);
        setConversationId(existing.conversationId);
        setTitle(existing.title);
        setCreatedAt(existing.createdAt);
        setMissing(false);
        setHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setMissing(true);
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [briefId]);

  const canAsk = ready && !busy && hydrated;
  const last = turns.at(-1)?.final ?? null;

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !canAsk) return;
    setQuestion("");
    setError(null);
    setBusy(true);
    setTurns((current) => [
      ...current,
      {
        question: trimmed,
        answer: "",
        final: null,
        asked_at: new Date().toISOString(),
      },
    ]);

    try {
      await briefStream(
        trimmed,
        {
          onToken: (token) => {
            setTurns((current) => {
              const index = current.findLastIndex((item) => !item.final);
              if (index < 0) return current;
              return current.map((item, i) =>
                i === index
                  ? { ...item, answer: stripCiteTrailer(item.answer + token) }
                  : item,
              );
            });
          },
          onFinal: (final) => {
            setConversationId(final.conversation_id);
            setTurns((current) => {
              const index = current.findLastIndex((item) => !item.final);
              if (index < 0) return current;
              const updated = current.map((item, i) =>
                i === index ? { ...item, answer: final.text, final } : item,
              );
              const id = final.conversation_id;
              const now = new Date().toISOString();
              setTitle(truncate(updated[0]?.question || trimmed));
              setCreatedAt((value) => value ?? now);
              notifyBriefsChanged();
              if (!briefId) {
                router.replace(`/briefs/${id}`);
              }
              return updated;
            });
          },
        },
        { conversationId },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brief failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeTurn(index: number) {
    if (!conversationId) return;
    setError(null);
    setDeletingTurn(true);
    try {
      const saved = await deleteBriefTurn(conversationId, index);
      setTurns(saved.turns);
      setTitle(saved.title);
      setPendingTurnDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that question");
    } finally {
      setDeletingTurn(false);
    }
  }

  function closePreview() {
    setPreviewDocId(null);
    setPreviewChunkId(null);
    setPreviewQuery(null);
  }

  async function openCite(cite: Citation, asked?: string) {
    try {
      const chunk = await getChunk(cite.chunk_id);
      if (!documents.some((doc) => doc.id === chunk.document_id)) {
        await getDocument(chunk.document_id);
        await refresh();
      }
      setPreviewDocId(chunk.document_id);
      setPreviewChunkId(chunk.id);
      setPreviewQuery(asked?.trim() || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that file");
    }
  }

  if (briefId && hydrated && missing && !turns.length) {
    return (
      <EmptyState
        icon={<IconBrief className="h-8 w-8" />}
        title="Brief not found"
        description="It may have been deleted."
        actions={
          <Button variant="secondary" onClick={() => router.push("/briefs")}>
            Back to briefs
          </Button>
        }
      />
    );
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title={title}
        backHref="/briefs"
        backLabel="Back to briefs"
        tooltip={
          createdAt
            ? `Saved ${formatWhen(createdAt)}. Answers cite a passage or refuse.`
            : ready
              ? "Answers cite a passage or refuse. Saved when the answer finishes."
              : "Load files in the library before asking."
        }
        actions={
          conversationId ? (
            <Button
              variant="secondary"
              icon={<IconTrash className="h-4 w-4 text-danger" />}
              onClick={() => setPendingDelete(true)}
            >
              Delete
            </Button>
          ) : null
        }
      />

      {!ready && !loading ? (
        <EmptyState
          icon={<IconFolder className="h-8 w-8" />}
          title="Collection is empty"
          description="Upload a file in the library, then come back to ask."
          actions={
            <Button variant="secondary" onClick={() => router.push("/library")}>
              Open library
            </Button>
          }
        />
      ) : null}

      {ready && hydrated && !turns.length ? (
        <EmptyState
          icon={<IconSpark className="h-8 w-8" />}
          title="Start this brief"
          description="Ask a question from the documents. The answer will cite a passage or refuse."
          actions={
            <>
              {EXAMPLES.map((example) => (
                <Button
                  key={example}
                  variant="secondary"
                  disabled={!canAsk}
                  onClick={() => ask(example)}
                >
                  {example}
                </Button>
              ))}
            </>
          }
        />
      ) : null}

      <div className="space-y-8">
        {turns.map((turn, index) => {
          const foundDocuments = turn.final
            ? uniqueFoundDocuments(turn.final.citations)
            : [];
          const streaming = busy && index === turns.length - 1 && !turn.final;
          return (
            <div key={`${turn.question}-${index}`} className="space-y-2.5">
              <div className="flex justify-end">
                <Card
                  className="max-w-[min(36rem,85%)]"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "2px solid white",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="m-0 text-[13px] font-medium text-muted">Question</p>
                      <p className="mt-1 mb-0 break-words text-base font-semibold">
                        {turn.question}
                      </p>
                      {turn.asked_at ? (
                        <p className="mt-1.5 mb-0 text-[12px] font-normal text-muted">
                          {formatDateTime(turn.asked_at)}
                        </p>
                      ) : null}
                    </div>
                    {turn.final && conversationId ? (
                      <IconButton
                        tone="danger"
                        className="-mr-1.5 -mt-1.5"
                        label="Delete question"
                        disabled={busy || deletingTurn}
                        onClick={() => setPendingTurnDelete(index)}
                      >
                        <IconTrash />
                      </IconButton>
                    ) : null}
                  </div>
                </Card>
              </div>

              <div className="flex justify-start pr-8 sm:pr-40">
                <Card className="min-w-0 w-full">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    {turn.final ? (
                      <Badge tone={turn.final.refused ? "danger" : "success"}>
                        {turn.final.refused
                          ? "Not in this dossier"
                          : `Based on ${turn.final.citations.length} passage${
                              turn.final.citations.length === 1 ? "" : "s"
                            }`}
                      </Badge>
                    ) : streaming ? (
                      <BriefProgressBadge />
                    ) : null}
                  </div>

                  <div className="rounded-[12px] bg-bg px-4 py-3">
                    <p
                      className={`m-0 whitespace-pre-wrap text-[15px] leading-7 ${
                        turn.final?.refused ? "text-danger" : ""
                      }`}
                    >
                      {streaming && !turn.answer ? (
                        <BriefThinkingCursor />
                      ) : (
                        <>
                          {turn.final?.text ?? turn.answer}
                          {streaming ? (
                            <span className="ml-0.5 inline-block h-4 w-[0.45em] animate-caret bg-ink" />
                          ) : null}
                        </>
                      )}
                    </p>
                  </div>

                  {foundDocuments.length ? (
                    <div className="mt-5">
                      <div className="mb-3 flex items-center gap-1">
                        <h2 className="m-0 text-base font-semibold">Found documents</h2>
                        <Tooltip content="Open a cited source to jump to the highlighted passage." />
                      </div>
                      <div
                        className={`grid gap-3 ${
                          foundDocuments.length > 1 ? "lg:grid-cols-2" : ""
                        }`}
                      >
                        {foundDocuments.map((cite) => (
                          <FoundDocumentCta
                            key={cite.document_id || cite.filename}
                            citation={cite}
                            onOpen={(cite) =>
                            void openCite(cite, turn.final?.rewritten_query || turn.question)
                          }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {turn.final ? <DebugDrawer final={turn.final} asked={turn.question} /> : null}
                </Card>
              </div>
            </div>
          );
        })}
      </div>

      {ready ? (
        <Card className={turns.length ? "mt-4" : "mt-6"}>
          <div className="mb-4 flex items-center gap-1">
            <h2 className="m-0 text-base font-semibold">
              {turns.length ? "Ask a follow-up" : "Ask from the documents"}
            </h2>
            <Tooltip
              content={
                turns.length
                  ? "Stay in this brief. The next answer is saved with the rest."
                  : "The brief is saved automatically when the answer finishes."
              }
            />
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            {turns.length ? (
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <Button
                    key={example}
                    variant="secondary"
                    size="sm"
                    disabled={!canAsk}
                    onClick={() => ask(example)}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            ) : null}
            <Textarea
              value={question}
              disabled={!canAsk}
              placeholder="Ask from the documents…"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask(question);
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {last ? (
                <p className="m-0 text-[13px] text-muted">
                  {formatMs(last.stats.embed_ms + last.stats.retrieve_ms + last.stats.llm_ms)} ·{" "}
                  {formatMoney(last.stats.cost_usd)} · {last.refused ? "Refused" : "Grounded"}
                </p>
              ) : null}
              <Button
                type="submit"
                className="ml-auto min-w-[7.5rem] px-6"
                disabled={!canAsk || !question.trim()}
                loading={busy}
                icon={<IconSend className="h-4 w-4" />}
              >
                Send
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <ConfirmDeleteModal
        open={pendingDelete && Boolean(conversationId)}
        title="Delete brief?"
        name={title}
        description="This will remove"
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => {
          if (!conversationId) return;
          void deleteBrief(conversationId).then(() => router.push("/briefs"));
        }}
      />

      <ConfirmDeleteModal
        open={pendingTurnDelete !== null}
        title="Delete question?"
        name={pendingTurnDelete !== null ? turns[pendingTurnDelete]?.question || "" : ""}
        description="This will remove the question and its answer"
        confirming={deletingTurn}
        onCancel={() => {
          if (deletingTurn) return;
          setPendingTurnDelete(null);
        }}
        onConfirm={() => {
          if (pendingTurnDelete === null) return;
          void removeTurn(pendingTurnDelete);
        }}
      />

      <FilePreview
        open={Boolean(previewFile)}
        documents={documents}
        file={previewFile}
        chunkId={previewChunkId}
        query={previewQuery}
        onSelect={(doc) => {
          setPreviewDocId(doc.id);
          setPreviewChunkId(doc.id === previewDocId ? previewChunkId : null);
          if (doc.id !== previewDocId) setPreviewQuery(null);
        }}
        onClose={closePreview}
        onDeleted={() => {
          closePreview();
          void refresh();
        }}
        onEdit={setEditing}
        suspendKeys={Boolean(editing)}
      />

      <EditDocumentModal
        open={Boolean(editing)}
        document={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}
