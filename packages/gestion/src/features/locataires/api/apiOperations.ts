import type { z } from 'zod';
import { invalid } from './apiErrors';
import { bankAccountInputSchema, contactPointChangesSchema, contactPointInputSchema, identifierChangesSchema, identifierInputSchema } from './apiInputs';
import type { BankAccountInput, ContactPointChanges, ContactPointInput, IdentifierChanges, IdentifierInput } from './apiInputs';
import { toBankAccount, toContactPoint, toIdentifier } from './apiMapping';
import type { BankAccount, ContactPoint, Identifier } from './apiMapping';
import { partyPath } from './apiReads';
import type { ApiContext } from './apiReads';
import { apiBankAccountResponseSchema, apiContactPointResponseSchema, apiIdentifierResponseSchema } from './apiSchemas';

export function parseInput<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw invalid(issue?.message ?? 'Saisie invalide.', typeof issue?.path[0] === 'string' ? issue.path[0] : undefined);
}

const omitUndefined = (body: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));

/**
 * Les coordonnées, pièces et comptes bancaires renvoient seulement des valeurs masquées : IBAN et numéros de pièce ne sont jamais conservés ici.
 */
export function partyOperations(context: ApiContext) {
  const { transport } = context;
  const stale = (tenantId: string): void => {
    context.latest.delete(tenantId);
  };
  const base = (tenantId: string): string => partyPath(tenantId);

  const bankBody = (raw: unknown): Record<string, unknown> => {
    const input = parseInput(bankAccountInputSchema, raw);
    return omitUndefined({ iban: input.iban, bic: input.bic === '' ? undefined : input.bic?.toUpperCase(), holder_name: input.holderName, valid_from: input.validFrom });
  };

  return {
    addContactPoint: async (tenantId: string, raw: ContactPointInput): Promise<ContactPoint> => {
      const input = parseInput(contactPointInputSchema, raw);
      const { data } = await transport.post(`${base(tenantId)}/contact-points`, apiContactPointResponseSchema, omitUndefined({ type: input.type, value: input.value, label: input.label, is_primary: input.primary ?? false }));
      stale(tenantId);
      return toContactPoint(data);
    },
    updateContactPoint: async (tenantId: string, contactPointId: string, raw: ContactPointChanges): Promise<ContactPoint> => {
      const changes = parseInput(contactPointChangesSchema, raw);
      const { data } = await transport.patch(`${base(tenantId)}/contact-points/${encodeURIComponent(contactPointId)}`, apiContactPointResponseSchema, omitUndefined({ value: changes.value, label: changes.label, is_primary: changes.primary }));
      stale(tenantId);
      return toContactPoint(data);
    },
    addIdentifier: async (tenantId: string, raw: IdentifierInput): Promise<Identifier> => {
      const input = parseInput(identifierInputSchema, raw);
      const { data } = await transport.post(`${base(tenantId)}/identifiers`, apiIdentifierResponseSchema, { scheme: input.scheme, country: input.country, value: input.value });
      stale(tenantId);
      return toIdentifier(data);
    },
    updateIdentifier: async (tenantId: string, identifierId: string, raw: IdentifierChanges): Promise<Identifier> => {
      const changes = parseInput(identifierChangesSchema, raw);
      const { data } = await transport.patch(`${base(tenantId)}/identifiers/${encodeURIComponent(identifierId)}`, apiIdentifierResponseSchema, omitUndefined({ country: changes.country, value: changes.value }));
      stale(tenantId);
      return toIdentifier(data);
    },
    addBankAccount: async (tenantId: string, raw: BankAccountInput): Promise<BankAccount> => {
      const { data } = await transport.post(`${base(tenantId)}/bank-accounts`, apiBankAccountResponseSchema, bankBody(raw));
      stale(tenantId);
      return toBankAccount(data);
    },
    replaceBankAccount: async (tenantId: string, bankAccountId: string, raw: BankAccountInput): Promise<BankAccount> => {
      const { data } = await transport.post(`${base(tenantId)}/bank-accounts/${encodeURIComponent(bankAccountId)}/replacement`, apiBankAccountResponseSchema, bankBody(raw));
      stale(tenantId);
      return toBankAccount(data);
    },
  };
}
