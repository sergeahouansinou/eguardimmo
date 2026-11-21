export const invoicingPaths = {
  invoices: '/finances/factures',
  newInvoice: (recipientId?: string) => (recipientId ? `/finances/factures/nouvelle?destinataire=${encodeURIComponent(recipientId)}` : '/finances/factures/nouvelle'),
  invoice: (id: string) => `/finances/factures/${id}`,
  editInvoice: (id: string) => `/finances/factures/${id}/modifier`,
};
