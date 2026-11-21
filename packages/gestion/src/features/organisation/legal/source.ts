'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { LegalIdentity, LegalIdentityInput, LegalIdentityState, LegalPermissions } from './model';

export interface LegalIdentitySource {
  readonly permissions: LegalPermissions;
  load: () => Promise<LegalIdentityState>;
  save: (input: LegalIdentityInput) => Promise<LegalIdentity>;
}

const context = createSourceContext<LegalIdentitySource>('Identité légale', () => {
  throw new MissingSourceError('Identité légale');
});

export const LegalIdentitySourceProvider = context.SourceProvider;
export const useLegalIdentitySource = context.useSource;
