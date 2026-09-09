export function statusCopy(status: string, errorCode: string | null): string {
  if (status === "failed" && errorCode === "unreadable_pdf") {
    return "This PDF has no text layer. Dossier does not OCR scanned pages.";
  }
  if (status === "failed" && errorCode === "unreadable_image") {
    return "This file is not a readable PNG, JPEG, GIF, WebP, or BMP image.";
  }
  if (errorCode === "vision_failed") {
    return "Image stored, but visible text was not extracted";
  }
  switch (status) {
    case "queued":
      return "Waiting";
    case "parsing":
      return "Reading pages";
    case "chunking":
      return "Splitting passages";
    case "embedding":
      return "Indexing";
    case "ready":
      return "Ready";
    case "failed":
      return errorCode ? `Could not read (${errorCode})` : "Could not read";
    default:
      return status;
  }
}
