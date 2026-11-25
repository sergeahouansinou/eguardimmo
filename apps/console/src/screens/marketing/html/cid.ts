const IMAGE_TAG = /<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const PREVIEW_POLICY = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

/** Le document produit par DOMParser est inerte : aucun script ne s’y exécute et aucune ressource n’y est chargée. */
export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function cidKey(source: string | null): string | null {
  return source?.startsWith('cid:') ? source.slice(4) : null;
}

export function citedImageKeys(html: string): Set<string> {
  const keys = Array.from(parseHtml(html).querySelectorAll('img'), (image) => cidKey(image.getAttribute('src')));
  return new Set(keys.filter((key) => key !== null));
}

export function removeImageTags(html: string, key: string): string {
  return html.replace(IMAGE_TAG, (tag) => (citedImageKeys(tag).has(key) ? '' : tag));
}

export function imageTag(key: string, alt: string): string {
  const escaped = alt.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<img src="cid:${key}" alt="${escaped}">`;
}

export function previewDocument(html: string, sources: Readonly<Record<string, string>>): string {
  const page = parseHtml(html);
  for (const unwanted of page.querySelectorAll('meta[http-equiv], base')) unwanted.remove();
  for (const image of page.querySelectorAll('img')) {
    const key = cidKey(image.getAttribute('src'));
    const source = key === null ? undefined : sources[key];
    if (source !== undefined) image.setAttribute('src', source);
  }
  const charset = page.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const policy = page.createElement('meta');
  policy.setAttribute('http-equiv', 'Content-Security-Policy');
  policy.setAttribute('content', PREVIEW_POLICY);
  page.head.prepend(charset, policy);
  return `<!doctype html>${page.documentElement.outerHTML}`;
}
