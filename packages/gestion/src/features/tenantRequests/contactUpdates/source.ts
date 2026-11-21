'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { Page } from '../shared/model';
import type { ContactUpdate } from './model';

export interface ContactUpdatesSource {
  list: (partyId: string, cursor: string | null) => Promise<Page<ContactUpdate>>;
  apply: (partyId: string, id: string) => Promise<ContactUpdate>;
  dismiss: (partyId: string, id: string) => Promise<ContactUpdate>;
}

const context = createSourceContext<ContactUpdatesSource>('Demandes de modification de coordonnées', () => {
  throw new MissingSourceError('Demandes de modification de coordonnées');
});

export const ContactUpdatesSourceProvider = context.SourceProvider;
export const useContactUpdatesSource = context.useSource;
