import type { AcceptAccessInput, AccessGrant, AccessPage, AccessStatus } from './model';

export interface SupportAccessSource {
  list: (status: AccessStatus | null, cursor: string | null) => Promise<AccessPage>;
  accept: (id: string, input: AcceptAccessInput) => Promise<AccessGrant>;
  refuse: (id: string) => Promise<AccessGrant>;
  revoke: (id: string) => Promise<AccessGrant>;
}
