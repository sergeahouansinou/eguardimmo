import type { FailureWording } from './errors';

export const DOCUMENT_CODES: Readonly<Record<string, string>> = {
  lease_document_invalid: 'Ce document n’est plus utilisable : son fichier est absent ou illisible. Signalez-le à votre agence pour qu’elle le partage à nouveau.',
};

export const DOCUMENT_WORDING: FailureWording = {
  codes: DOCUMENT_CODES,
};
