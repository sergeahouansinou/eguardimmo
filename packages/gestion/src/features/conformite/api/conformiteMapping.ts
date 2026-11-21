import type { Certificate, CertificateType, ValueField } from '../model';
import type { ApiCertificate, ApiTerm } from './conformiteSchemas';

export const toCertificate = (api: ApiCertificate): Certificate => ({
  id: api.id,
  subject: api.subject,
  type: { id: api.type.id, key: api.type.key, label: api.type.label, semanticKey: api.type.semantic_key },
  reference: api.reference,
  issuerPartyId: api.issuer_party_id,
  issuedOn: api.issued_on,
  expiresOn: api.expires_on,
  state: api.state,
  values: api.values,
  storedFileId: api.stored_file_id,
  replacesId: api.replaces_id,
  replacedById: api.replaced_by_id,
});

export function toCertificateType(api: ApiTerm): CertificateType {
  const schema = api.metadata.data_schema ?? {};
  const fields: ValueField[] = Object.entries(schema).map(([key, definition]) => ({
    key,
    kind: definition.type,
    required: definition.required === true,
    options: definition.enum ?? null,
    min: definition.min ?? null,
    max: definition.max ?? null,
  }));
  return {
    id: api.id,
    key: api.key,
    label: api.labels.fr ?? api.key,
    semanticKey: api.semantic_key,
    defaultValidityMonths: api.metadata.default_validity_months ?? null,
    reminderDays: api.metadata.reminder_days ?? 0,
    fields,
  };
}
