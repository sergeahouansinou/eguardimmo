'use client';

import { useRecipients } from './hooks';

export interface RecipientDirectory {
  ready: boolean;
  failed: boolean;
  options: { value: string; label: string }[];
  nameOf: (partyId: string) => string | null;
}

export function useRecipientDirectory(): RecipientDirectory {
  const recipients = useRecipients();
  const list = recipients.data ?? [];
  return {
    ready: recipients.data !== undefined,
    failed: recipients.isError,
    options: list.filter((party) => !party.archived && !party.anonymized).map((party) => ({ value: party.id, label: party.email ? `${party.name} · ${party.email}` : party.name })),
    nameOf: (partyId) => {
      const party = list.find((candidate) => candidate.id === partyId);
      if (party === undefined) return null;
      return party.anonymized ? 'Partie anonymisée' : party.name;
    },
  };
}
