export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} o`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
