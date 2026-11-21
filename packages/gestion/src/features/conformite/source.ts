'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type { Certificate, CertificateQuery, CertificateType, ConformitePermissions, DownloadedFile, NewCertificateInput, Page, RenewCertificateInput } from './model';

export interface ConformiteSource {
  readonly permissions: ConformitePermissions;
  readonly organizationId: string | null;
  certificateTypes: () => Promise<CertificateType[]>;
  certificates: (query: CertificateQuery) => Promise<Page<Certificate>>;
  certificate: (id: string) => Promise<Certificate>;
  createCertificate: (input: NewCertificateInput) => Promise<Certificate>;
  renewCertificate: (current: Certificate, input: RenewCertificateInput) => Promise<Certificate>;
  downloadFile: (fileId: string) => Promise<DownloadedFile>;
}

const context = createSourceContext<ConformiteSource>('Conformité', () => {
  throw new MissingSourceError('Conformité');
});

export const ConformiteSourceProvider = context.SourceProvider;
export const useConformiteSource = context.useSource;
