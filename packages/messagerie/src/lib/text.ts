export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function attachmentCountLabel(count: number): string {
  return `${String(count)} ${count < 2 ? 'pièce jointe' : 'pièces jointes'}`;
}
