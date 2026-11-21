export const bankingPaths = {
  lines: '/finances/banque',
  linesOf: (accountId: string) => `/finances/banque?compte=${encodeURIComponent(accountId)}`,
  linesAfterImport: (accountId: string) => `/finances/banque?compte=${encodeURIComponent(accountId)}&calcul=1`,
  accounts: '/finances/banque/comptes',
  statements: '/finances/banque/releves',
  statement: (id: string) => `/finances/banque/releves/${encodeURIComponent(id)}`,
  import: '/finances/banque/import',
  importFor: (accountId: string) => `/finances/banque/import?compte=${encodeURIComponent(accountId)}`,
  reconciliations: '/finances/banque/etats',
  reconciliation: (id: string) => `/finances/banque/etats/${encodeURIComponent(id)}`,
  closing: '/finances/cloture',
  security: '/compte/securite',
};
