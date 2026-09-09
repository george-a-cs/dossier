import { clearToken, getToken } from "./auth";
import type {
  AuthUser,
  BriefFinal,
  Chunk,
  Collection,
  Document,
  OcrBox,
  QueryEvent,
} from "./types";

export function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function authHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = authHeaders(init.headers);
  const response = await fetch(`${apiUrl()}${path}`, { ...init, headers });
  if (response.status === 401 && !path.startsWith("/auth/login")) {
    clearToken();
    onUnauthorized?.();
  }
  return response;
}

async function readDetail(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    /* use raw text */
  }
  return text || `${response.status} ${response.statusText}`;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readDetail(response));
  }
  return response.json() as Promise<T>;
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  return json(
    await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

export async function logout(): Promise<void> {
  const response = await request("/auth/logout", { method: "POST" });
  if (!response.ok && response.status !== 401) {
    throw new Error(await readDetail(response));
  }
}

export async function me(): Promise<AuthUser> {
  return json(await request("/auth/me"));
}

export async function updateProfile(body: {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}): Promise<AuthUser> {
  return json(
    await request("/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function listUsers(): Promise<AuthUser[]> {
  return json(await request("/users"));
}

export async function createUser(body: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  return json(
    await request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function health(): Promise<{ status: string }> {
  return json(await request("/healthz"));
}

export async function createCollection(
  id = "default",
  name = "Default",
): Promise<Collection> {
  return json(
    await request("/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    }),
  );
}

export async function listDocuments(collectionId = "default"): Promise<Document[]> {
  const response = await request(`/collections/${collectionId}/documents`);
  if (response.status === 404) return [];
  return json(response);
}

export async function getDocument(documentId: string): Promise<Document> {
  return json(await request(`/documents/${documentId}`));
}

export function documentFileUrl(documentId: string): string {
  return `${apiUrl()}/documents/${documentId}/file`;
}

export async function fetchDocumentFile(documentId: string): Promise<ArrayBuffer> {
  const response = await request(`/documents/${documentId}/file`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await request(`/documents/${documentId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }
}

export async function listDocumentChunks(documentId: string): Promise<Chunk[]> {
  return json(await request(`/documents/${documentId}/chunks`));
}

export async function listQueryEvents(
  collectionId = "default",
): Promise<QueryEvent[]> {
  const response = await request(`/collections/${collectionId}/events`);
  if (response.status === 404) return [];
  return json(response);
}

export async function upload(
  file: File,
  collectionId = "default",
  meta: { category?: string | null; notes?: string | null } = {},
): Promise<Document> {
  await createCollection(collectionId);
  const body = new FormData();
  body.append("file", file);
  if (meta.category?.trim()) body.append("category", meta.category.trim());
  if (meta.notes?.trim()) body.append("notes", meta.notes.trim());
  return json(
    await request(`/collections/${collectionId}/documents`, {
      method: "POST",
      body,
    }),
  );
}

export async function updateDocumentMeta(
  documentId: string,
  meta: { category?: string | null; notes?: string | null },
): Promise<Document> {
  return json(
    await request(`/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: meta.category?.trim() || null,
        notes: meta.notes?.trim() || null,
      }),
    }),
  );
}

export async function getChunk(chunkId: string): Promise<Chunk> {
  return json(await request(`/chunks/${chunkId}`));
}

export async function getDocumentLayout(documentId: string): Promise<OcrBox[]> {
  const body = await json<{ boxes?: OcrBox[] }>(
    await request(`/documents/${documentId}/layout`),
  );
  return Array.isArray(body.boxes) ? body.boxes : [];
}

export async function briefStream(
  question: string,
  handlers: {
    onToken: (token: string) => void;
    onFinal: (final: BriefFinal) => void;
  },
  options: { collectionId?: string; conversationId?: string | null } = {},
): Promise<void> {
  const collectionId = options.collectionId ?? "default";
  const response = await request(`/collections/${collectionId}/brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      conversation_id: options.conversationId ?? null,
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = /^event: (.+)$/m.exec(part)?.[1];
      const dataLine = part
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!event || !dataLine) continue;
      const data = JSON.parse(dataLine.slice(6));
      if (event === "token") handlers.onToken(data.t as string);
      if (event === "final") handlers.onFinal(data as BriefFinal);
    }
  }
}

export function stripCiteTrailer(raw: string): string {
  const marked = raw.search(/\n\s*\{\s*"chunk_ids"/);
  if (marked >= 0) return raw.slice(0, marked).trimEnd();
  const start = raw.lastIndexOf('{"');
  if (start >= 0 && raw.slice(start).includes("chunk")) {
    return raw.slice(0, start).trimEnd();
  }
  return raw;
}
