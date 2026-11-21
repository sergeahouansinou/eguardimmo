export { mockRentApi as mockInvoicingApi } from '../../rent/api/testing';
export type { MockRoute, RecordedCall } from '../../rent/api/testing';

export const orgPath = (organization: string, path: string): string => `/api/v1/org/${organization}${path}`;
