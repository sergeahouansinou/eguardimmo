export type FormatKind = 'bold' | 'italic' | 'underline';

export interface FormatNode {
  kind: 'text' | FormatKind;
  text: string;
}

export interface FormatEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

const MARKERS: Record<FormatKind, string> = { bold: '**', italic: '*', underline: '__' };
const PATTERN = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*/gs;

export function toggleFormat(value: string, start: number, end: number, kind: FormatKind): FormatEdit {
  const marker = MARKERS[kind];
  const size = marker.length;
  const selected = value.slice(start, end);
  const wrapped = value.slice(start - size, start) === marker && value.slice(end, end + size) === marker;
  if (wrapped) {
    return { value: `${value.slice(0, start - size)}${selected}${value.slice(end + size)}`, selectionStart: start - size, selectionEnd: end - size };
  }
  return { value: `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`, selectionStart: start + size, selectionEnd: end + size };
}

export function parseFormatted(source: string): FormatNode[] {
  const nodes: FormatNode[] = [];
  let cursor = 0;
  for (const match of source.matchAll(PATTERN)) {
    if (match.index > cursor) nodes.push({ kind: 'text', text: source.slice(cursor, match.index) });
    if (match[1] !== undefined) nodes.push({ kind: 'bold', text: match[1] });
    else if (match[2] !== undefined) nodes.push({ kind: 'underline', text: match[2] });
    else nodes.push({ kind: 'italic', text: match[3] ?? '' });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) nodes.push({ kind: 'text', text: source.slice(cursor) });
  return nodes;
}
