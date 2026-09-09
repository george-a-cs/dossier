export type DocumentStatus =
  | "queued"
  | "parsing"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

export type Document = {
  id: string;
  collection_id: string;
  filename: string;
  mime: string;
  byte_size: number | null;
  status: DocumentStatus;
  error_code: string | null;
  page_count: number | null;
  chunk_count: number;
  created_at: string | null;
  category?: string | null;
  notes?: string | null;
};

export type Citation = {
  chunk_id: string;
  document_id?: string;
  filename: string;
  page_start: number | null;
  page_end: number | null;
};

export type BriefStats = {
  embed_ms: number;
  retrieve_ms: number;
  llm_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd?: number;
};

export type RetrievalTrace = {
  chunk_id: string;
  filename: string;
  rrf_score: number;
  rrf_rank: number;
  vector_rank: number | null;
  fts_rank: number | null;
  page_start: number | null;
  snippet: string;
};

export type BriefFinal = {
  text: string;
  citations: Citation[];
  refused: boolean;
  retrieval_ids: string[];
  rewritten_query?: string;
  retrieval?: RetrievalTrace[];
  conversation_id: string;
  stats: BriefStats;
};

export type OcrBox = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Chunk = {
  id: string;
  document_id: string;
  text: string;
  filename: string;
  page_start: number | null;
  page_end: number | null;
  section_title: string | null;
  chunk_index: number;
};

export type UserRole = "super_admin" | "member";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
};

export type Collection = {
  id: string;
  name: string;
  embedding_model: string;
};

export type QueryEvent = {
  id: string;
  request_id: string;
  collection_id: string;
  embed_ms: number;
  retrieve_ms: number;
  llm_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  citation_valid: boolean;
  refused: boolean;
  created_at: string;
};

export type SavedTurn = {
  question: string;
  answer: string;
  final: BriefFinal | null;
};

export type SavedBrief = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  conversationId: string;
  turns: SavedTurn[];
};
