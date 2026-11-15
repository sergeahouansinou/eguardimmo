export type RichKind = 'bold' | 'italic' | 'underline';

export interface RichNode {
  kind: 'text' | RichKind;
  text: string;
}

const MARKERS: Record<RichKind, string> = { bold: '**', italic: '*', underline: '__' };

export interface RichEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function toggleFormat(value: string, start: number, end: number, kind: RichKind): RichEdit {
  const marker = MARKERS[kind];
  const size = marker.length;
  const selected = value.slice(start, end);
  const wrapped = value.slice(start - size, start) === marker && value.slice(end, end + size) === marker;
  if (wrapped) {
    return {
      value: `${value.slice(0, start - size)}${selected}${value.slice(end + size)}`,
      selectionStart: start - size,
      selectionEnd: end - size,
    };
  }
  return {
    value: `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`,
    selectionStart: start + size,
    selectionEnd: end + size,
  };
}

const PATTERN = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*/gs;

export function parseRichText(source: string): RichNode[] {
  const nodes: RichNode[] = [];
  let cursor = 0;
  for (const match of source.matchAll(PATTERN)) {
    const index = match.index;
    if (index > cursor) nodes.push({ kind: 'text', text: source.slice(cursor, index) });
    if (match[1] !== undefined) nodes.push({ kind: 'bold', text: match[1] });
    else if (match[2] !== undefined) nodes.push({ kind: 'underline', text: match[2] });
    else nodes.push({ kind: 'italic', text: match[3] ?? '' });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) nodes.push({ kind: 'text', text: source.slice(cursor) });
  return nodes;
}

export function stripRichText(source: string): string {
  return parseRichText(source)
    .map((node) => node.text)
    .join('');
}
