import { ConformiteApiError } from '../../api/conformiteErrors';

const CODE_MESSAGES: Readonly<Record<string, string>> = {
  library_document_not_found: 'Ce document n’existe pas ou n’est plus dans la bibliothèque de votre organisation.',
  library_kind_subject_mismatch: 'Cette nature de document impose un objet précis : un mandat pour un mandat, un bail pour un bail.',
  document_not_clean: 'Ce fichier n’a pas fini son analyse antivirus ou n’est pas sain : il ne peut pas être utilisé pour l’instant.',
  subject_not_found: 'L’objet choisi n’existe pas dans votre organisation ou ne peut pas porter de document.',
  mandate_agency_only: 'Le rattachement à un mandat est réservé aux agences.',
};

const FIELD_OF_CODE: Readonly<Record<string, string>> = {
  library_kind_subject_mismatch: 'subject',
  subject_not_found: 'subject',
};

export function toLibraryError(error: unknown): unknown {
  if (!(error instanceof ConformiteApiError)) return error;
  const message = CODE_MESSAGES[error.code];
  if (message === undefined) return error;
  const field = FIELD_OF_CODE[error.code];
  return new ConformiteApiError(error.kind, message, {
    ...(error.status === null ? {} : { status: error.status }),
    code: error.code,
    fieldMessages: field === undefined ? error.fieldMessages : { ...error.fieldMessages, [field]: message },
    cause: error,
  });
}
