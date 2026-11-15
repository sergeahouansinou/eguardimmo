import type { DemoCollection } from '../locataires/kit/collection';
import { NotFoundError } from '../locataires/kit/collection';
import { todayIso } from '../locataires/kit/dates';
import { nextSequence } from '../locataires/kit/ids';
import { parseOrThrow } from './parse';
import { defaultSignatureFields, signatureFileNames, signatureInputSchema } from './schemas';
import type { Signature } from './schemas';
import type { CourriersSource } from './sourceTypes';

type SignaturesApi = Pick<CourriersSource, 'signatures' | 'createSignature' | 'remindSignature' | 'cancelSignature'>;

export function createSignaturesSource(signatures: DemoCollection<Signature>): SignaturesApi {
  return {
    signatures: () => Promise.resolve(signatures.all()),
    createSignature: (raw) => {
      const values = parseOrThrow(signatureInputSchema, raw);
      const files = signatureFileNames(values);
      const reference = nextSequence(signatures.all().map((entry) => entry.reference), 'SG', Number(todayIso().slice(0, 4)), 4);
      return Promise.resolve(
        signatures.add({
          id: reference.toLowerCase(),
          reference,
          title: values.title,
          fileName: files[0] ?? '',
          files,
          unitId: values.unitId === undefined || values.unitId === '' ? null : values.unitId,
          signers: values.signers.map((signer) => ({ name: signer.name.trim(), email: signer.email.trim(), status: 'attente' as const })),
          status: 'en_cours',
          createdOn: todayIso(),
          completedOn: null,
          reminderSentOn: null,
          fields: values.fields && values.fields.length > 0 ? values.fields : defaultSignatureFields(values.signers.length),
        }),
      );
    },
    remindSignature: (id) => {
      const current = signatures.find(id);
      if (!current) return Promise.reject(new NotFoundError('Signature', id));
      if (current.status !== 'en_cours') return Promise.reject(new Error('Seule une demande en cours peut être relancée.'));
      return Promise.resolve(signatures.patch(id, { reminderSentOn: todayIso() }));
    },
    cancelSignature: (id) => {
      const current = signatures.find(id);
      if (!current) return Promise.reject(new NotFoundError('Signature', id));
      if (current.status !== 'en_cours') return Promise.reject(new Error('Seule une demande en cours peut être annulée.'));
      return Promise.resolve(signatures.patch(id, { status: 'annule' }));
    },
  };
}
