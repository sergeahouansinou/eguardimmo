export const investmentsPaths = {
  loans: '/finances/prets',
  loan: (id: string): string => `/finances/prets/${encodeURIComponent(id)}`,
  acquisitions: '/finances/cout-de-revient',
} as const;
