export interface SitemapEntry {
  url: string;
  changeFrequency: "daily" | "weekly" | "yearly";
  priority: number;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export function sitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map((entry) => `<url><loc>${escapeXml(entry.url)}</loc><changefreq>${entry.changeFrequency}</changefreq><priority>${entry.priority.toFixed(1)}</priority></url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
