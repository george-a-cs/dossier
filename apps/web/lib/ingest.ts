import { listDocuments, upload } from "./api";
import { statusCopy } from "./status";
import type { Document } from "./types";

export async function uploadFiles(
  files: FileList | File[],
  meta: { category?: string | null; notes?: string | null } = {},
): Promise<{
  documents: Document[];
  error: string | null;
}> {
  let error: string | null = null;
  for (const file of Array.from(files)) {
    const doc = await upload(file, "default", meta);
    if (doc.status === "failed") {
      error = statusCopy(doc.status, doc.error_code);
    }
  }
  return { documents: await listDocuments(), error };
}
