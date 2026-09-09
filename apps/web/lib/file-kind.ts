export type FileKind = "pdf" | "md" | "txt" | "csv" | "xlsx" | "docx" | "image" | "file";

export const UPLOAD_ACCEPT =
  ".pdf,.md,.txt,.csv,.xls,.xlsx,.xlsm,.doc,.docx,.docm,.png,.jpg,.jpeg,.gif,.webp,.bmp,application/pdf,text/markdown,text/plain,text/csv,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/gif,image/webp,image/bmp";

export const UPLOAD_TYPES_LABEL =
  "PDF, Word, Excel, CSV, Markdown, text, or image";

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  md: "Markdown",
  txt: "Text",
  csv: "CSV",
  xlsx: "Excel",
  docx: "Word",
  image: "Image",
  file: "File",
};

export function fileKind(filename: string, mime?: string | null): FileKind {
  const lower = filename.toLowerCase();
  const type = (mime ?? "").toLowerCase();
  if (lower.endsWith(".pdf") || type.includes("pdf")) return "pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || type.includes("markdown")) {
    return "md";
  }
  if (lower.endsWith(".csv") || type.includes("csv")) return "csv";
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xlsm") ||
    lower.endsWith(".xls") ||
    type.includes("spreadsheetml") ||
    type === "application/vnd.ms-excel"
  ) {
    return "xlsx";
  }
  if (
    lower.endsWith(".docx") ||
    lower.endsWith(".docm") ||
    lower.endsWith(".doc") ||
    type.includes("wordprocessingml") ||
    type === "application/msword" ||
    type.includes("msword")
  ) {
    return "docx";
  }
  if (lower.endsWith(".txt") || type === "text/plain") return "txt";
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".bmp") ||
    type.startsWith("image/")
  ) {
    return "image";
  }
  return "file";
}
