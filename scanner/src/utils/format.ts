export const CONTENT_TYPE_LABELS: Record<string, string> = {
  "text/html": "HTML Page",
  "application/xhtml+xml": "XHTML Page",
  "text/xml": "XML Document",
  "application/xml": "XML Document",
  "application/rss+xml": "RSS Feed",
  "application/atom+xml": "Atom Feed",
  "application/json": "JSON Data",
  "application/ld+json": "JSON-LD Data",
  "text/plain": "Plain Text",
  "text/css": "Stylesheet",
  "text/javascript": "JavaScript",
  "application/javascript": "JavaScript",
  "application/pdf": "PDF Document",
  "image/png": "PNG Image",
  "image/jpeg": "JPEG Image",
  "image/gif": "GIF Image",
  "image/svg+xml": "SVG Image",
  "image/webp": "WebP Image",
  "image/x-icon": "Favicon",
  "image/vnd.microsoft.icon": "Favicon",
  "application/octet-stream": "Binary File",
  "multipart/form-data": "Form Data",
};

export function humanizeContentType(raw: string | null): string {
  if (!raw) return "Unknown";
  const mime = raw.split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_LABELS[mime] ?? mime;
}

export function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}
