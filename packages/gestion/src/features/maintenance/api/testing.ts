export { mockRentApi as mockMaintenanceApi } from '../../finances/rent/api/testing';
export type { MockRoute, RecordedCall } from '../../finances/rent/api/testing';

export const orgPath = (organization: string, path: string): string => `/api/v1/org/${organization}${path}`;
