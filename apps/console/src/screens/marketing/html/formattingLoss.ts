import { cidKey, parseHtml } from './cid';

const SUPPORTED: Readonly<Record<string, readonly string[]>> = {
  p: [],
  br: [],
  h1: [],
  h2: [],
  h3: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  strike: [],
  del: [],
  hr: [],
  ul: [],
  ol: ['start'],
  li: [],
  blockquote: [],
  pre: [],
  code: ['class'],
  a: ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
};

const SAFE_LINK = /^(?:https?:\/\/|mailto:|tel:)/i;

export const isSafeLink = (url: string): boolean => SAFE_LINK.test(url.trim());

function unsupported(element: Element): boolean {
  const allowed = Object.hasOwn(SUPPORTED, element.localName) ? SUPPORTED[element.localName] : undefined;
  if (allowed === undefined) return true;
  if (element.getAttributeNames().some((name) => !allowed.includes(name))) return true;
  if (element.localName === 'a') return !isSafeLink(element.getAttribute('href') ?? '');
  if (element.localName === 'img') return cidKey(element.getAttribute('src')) === null;
  return false;
}

export function losesFormatting(html: string): boolean {
  if (html.trim() === '') return false;
  const page = parseHtml(html);
  if (page.head.childElementCount > 0) return true;
  if (page.documentElement.attributes.length > 0 || page.body.attributes.length > 0) return true;
  if (page.createTreeWalker(page, NodeFilter.SHOW_COMMENT).nextNode() !== null) return true;
  return Array.from(page.body.querySelectorAll('*')).some(unsupported);
}
