import type { ApiClient } from '@eguardimmo/api';
import type { z } from 'zod';
import { createConfirmProof } from '../../../reauth/proof';
import type { Currency } from '../../../../format/money';
import { chargesPermissions } from '../permissions';
import type { ChargesOrganizationKind } from '../permissions';
import type { ChargesSource } from '../source';
import { toExercise, toExerciseDetail, toExpense, toKey, toStatement, toTerm } from './chargesMapping';
import { assertKey, exercisePayload, exerciseUpdatePayload, expensePayload, keyPayload, planPayload, reasonOf, versionPayload } from './chargesPayloads';
import {
  apiExerciseHeaderResponse,
  apiExercisePage,
  apiExerciseResponse,
  apiExpenseFileResponse,
  apiExpensePage,
  apiExpenseResponse,
  apiKeyList,
  apiKeyResponse,
  apiPropertyPage,
  apiStatementResponse,
  apiTerms,
  apiUnitPage,
} from './chargesSchemas';
import { createChargesTransport } from './chargesTransport';

export interface ApiChargesSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: string | null;
  kind: ChargesOrganizationKind | null;
}

export interface ApiChargesSourceDependencies {
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const CHOICE_PAGE_SIZE = 100;
const MAX_CHOICE_PAGES = 10;
const DEFAULT_CURRENCY: Currency = 'EUR';
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const segment = (id: string): string => encodeURIComponent(id);
const charges = (path: string): string => `/charges${path}`;

export function createApiChargesSource({ client, organizationId, role, kind }: ApiChargesSourceOptions, { fetchImpl }: ApiChargesSourceDependencies = {}): ChargesSource {
  const transport = createChargesTransport(client, organizationId, fetchImpl);

  const collect = async <S extends z.ZodType<{ data: unknown[]; meta: { next_cursor: string | null } }>, T>(path: string, schema: S, query: Record<string, string | undefined>, convert: (page: z.infer<S>) => T[]): Promise<T[]> => {
    const found: T[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_CHOICE_PAGES; page += 1) {
      const result: z.infer<S> = await transport.get(path, schema, { ...query, per_page: CHOICE_PAGE_SIZE, cursor });
      found.push(...convert(result));
      cursor = result.meta.next_cursor;
      if (cursor === null) break;
    }
    return found;
  };

  const statementAction = async (path: string, key?: string, body?: Record<string, unknown>) =>
    toStatement((await transport.post(charges(path), apiStatementResponse, { ...(key === undefined ? {} : { key: assertKey(key) }), ...(body === undefined ? {} : { body }) })).data);

  return {
    permissions: chargesPermissions(role, kind),
    expenses: async (query) => {
      const page = await transport.get(charges('/expenses'), apiExpensePage, {
        per_page: PAGE_SIZE,
        cursor: query.cursor,
        property_id: query.propertyId,
        status: query.status,
        settlement: query.settlement,
        from: query.from,
        to: query.to,
      });
      return { items: page.data.map(toExpense), nextCursor: page.meta.next_cursor };
    },
    expense: async (id) => toExpense((await transport.get(charges(`/expenses/${segment(id)}`), apiExpenseResponse)).data),
    recordExpense: async (input, key) => toExpense((await transport.post(charges('/expenses'), apiExpenseResponse, { body: expensePayload(input), key: assertKey(key) })).data),
    cancelExpense: async (id, reason) => toExpense((await transport.post(charges(`/expenses/${segment(id)}/cancel`), apiExpenseResponse, { body: { reason: reasonOf(reason) } })).data),
    approveExpense: async (id) => toExpense((await transport.post(charges(`/expenses/${segment(id)}/approve`), apiExpenseResponse)).data),
    attachExpenseFile: async (id, file) => {
      const body = new FormData();
      body.set('file', file);
      await transport.post(charges(`/expenses/${segment(id)}/files`), apiExpenseFileResponse, { body });
    },
    downloadExpenseFile: (id, fileId) => transport.blob(charges(`/expenses/${segment(id)}/files/${segment(fileId)}`), FILE_TYPES),
    exportExpenses: (query) => transport.blob(charges('/expenses.csv'), ['text/csv'], { from: query.from, to: query.to, property_id: query.propertyId }),
    keys: async (propertyId) => (await transport.get(charges(`/properties/${segment(propertyId)}/charge-keys`), apiKeyList)).data.map(toKey),
    createKey: async (propertyId, input) => toKey((await transport.post(charges(`/properties/${segment(propertyId)}/charge-keys`), apiKeyResponse, { body: keyPayload(input) })).data),
    addKeyVersion: async (propertyId, keyId, validFrom, shares) =>
      toKey((await transport.post(charges(`/properties/${segment(propertyId)}/charge-keys/${segment(keyId)}/versions`), apiKeyResponse, { body: versionPayload(validFrom, shares) })).data),
    archiveKey: async (propertyId, keyId) => toKey((await transport.post(charges(`/properties/${segment(propertyId)}/charge-keys/${segment(keyId)}/archive`), apiKeyResponse)).data),
    exercises: async (query) => {
      const page = await transport.get(charges('/exercises'), apiExercisePage, { per_page: PAGE_SIZE, cursor: query.cursor, property_id: query.propertyId, status: query.status });
      return { items: page.data.map(toExercise), nextCursor: page.meta.next_cursor };
    },
    exercise: async (id) => toExerciseDetail((await transport.get(charges(`/exercises/${segment(id)}`), apiExerciseResponse)).data),
    createExercise: async (input) => toExerciseDetail((await transport.post(charges('/exercises'), apiExerciseResponse, { body: exercisePayload(input) })).data),
    updateExercise: async (id, lockVersion, items) => toExerciseDetail((await transport.patch(charges(`/exercises/${segment(id)}`), apiExerciseResponse, exerciseUpdatePayload(lockVersion, items))).data),
    computeExercise: async (id) => toExerciseDetail((await transport.post(charges(`/exercises/${segment(id)}/compute`), apiExerciseResponse)).data),
    discardExercise: async (id) => toExercise((await transport.post(charges(`/exercises/${segment(id)}/discard`), apiExerciseHeaderResponse)).data),
    issueExercise: async (id, key, acknowledgePrescription) =>
      toExerciseDetail((await transport.post(charges(`/exercises/${segment(id)}/issue`), apiExerciseResponse, { key: assertKey(key), body: acknowledgePrescription ? { acknowledge_prescription: true } : {} })).data),
    exportStatements: (exerciseId) => transport.blob(charges(`/exercises/${segment(exerciseId)}/statements.csv`), ['text/csv']),
    statement: async (id) => toStatement((await transport.get(charges(`/statements/${segment(id)}`), apiStatementResponse)).data),
    downloadStatementPdf: (id) => transport.blob(charges(`/statements/${segment(id)}/pdf`), ['application/pdf']),
    retryStatement: (id, key) => statementAction(`/statements/${segment(id)}/retry`, key),
    rectifyStatement: async (id, reason, key) =>
      toExerciseDetail((await transport.post(charges(`/statements/${segment(id)}/rectify`), apiExerciseResponse, { key: assertKey(key), body: { reason: reasonOf(reason) } })).data),
    recordPlan: (id, input, key) => statementAction(`/statements/${segment(id)}/installment-plan`, key, planPayload(input)),
    shareStatementFile: async (statementId, fileId, visible) =>
      toStatement((await transport.patch(charges(`/statements/${segment(statementId)}/files/${segment(fileId)}`), apiStatementResponse, { tenant_visible: visible })).data),
    properties: () => collect('/properties', apiPropertyPage, {}, (page) => page.data.filter((property) => property.archived_at === null).map((property) => ({ id: property.id, name: property.name }))),
    units: (propertyId) => collect('/units', apiUnitPage, { property: propertyId }, (page) => page.data.map((unit) => ({ id: unit.id, reference: unit.reference, surfaceHundredths: unit.surface_hundredths }))),
    terms: async (vocabulary) => (await transport.get(`/catalog/vocabularies/${vocabulary}/terms`, apiTerms)).data.filter((term) => !term.archived && !term.hidden).map(toTerm),
    currency: async () => {
      const page = await transport.get(charges('/expenses'), apiExpensePage, { per_page: 1 });
      return page.data[0]?.total_gross.currency ?? DEFAULT_CURRENCY;
    },
    confirmTwoFactor: createConfirmProof(client),
  };
}
