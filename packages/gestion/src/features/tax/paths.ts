export const taxPaths = {
  home: '/finances/fiscalite',
  summary: (id: string): string => `/finances/fiscalite/${encodeURIComponent(id)}`,
} as const;
