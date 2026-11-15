export type SourceErrorCode =
  | 'introuvable'
  | 'etat_invalide'
  | 'mandat_inactif'
  | 'code_invalide'
  | 'donnees_invalides';

export class SourceError extends Error {
  readonly code: SourceErrorCode;

  constructor(code: SourceErrorCode, message: string) {
    super(message);
    this.name = 'SourceError';
    this.code = code;
  }
}
