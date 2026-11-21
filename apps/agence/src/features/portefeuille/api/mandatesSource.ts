import type { ApiClient, Query } from "@eguardimmo/api";
import { MandatesApiError, unsupported } from "./apiErrors";
import { TERM_DEFAULTS_NOT_FOUND_CODE, apiTermDefaultsResponseSchema, termDefaultsPayload } from "./apiDefaults";
import type { ApiTermDefaults, TermDefaultsInput } from "./apiDefaults";
import { apiMandateDocumentPageSchema, apiMandateDocumentResponseSchema, apiStoredFileResponseSchema, mandateFileForm, shareDocumentPayload } from "./apiDocuments";
import type { ApiMandateDocument, ShareableKind } from "./apiDocuments";
import { activatePayload, addUnitPayload, amendPayload, createPayload, endUnitPayload, renewPayload, terminatePayload, updatePayload, versionPayload } from "./apiPayloads";
import type { MandateChanges, NewMandateInput, TermsAmendmentInput, TerminationInput, MandateUnitInput } from "./apiPayloads";
import { apiEndRequestDismissedSchema, apiEndRequestResponseSchema, apiMandantListSchema, apiMandatePageSchema, apiMandateResponseSchema, apiPartyPageSchema, apiTermListSchema, apiUnitPageSchema } from "./apiSchemas";
import type { ApiEndRequest, ApiMandant, ApiMandateDetail, ApiMandateStatus, ApiMandateSummary } from "./apiSchemas";
import { createTransport } from "./apiTransport";

export const PAGE_SIZE = 100;
export const MANDANT_PAGE_SIZE = 200;
export const MAX_PAGES = 50;

export interface MandateListQuery {
  search?: string;
  status?: ApiMandateStatus;
  mandantId?: string;
  unitId?: string;
  archived?: boolean;
  cursor?: string;
  perPage?: number;
}

export interface MandatePage {
  items: ApiMandateSummary[];
  nextCursor: string | null;
}

export interface PartyOption {
  id: string;
  name: string;
  kind: "person" | "company";
}

export interface UnitOption {
  id: string;
  reference: string;
  propertyName: string;
}

export interface MandateTypeOption {
  id: string;
  key: string;
  label: string;
  semanticKey: string | null;
}

export interface ApiMandatesSourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

export interface MandatesSource {
  list: (query?: MandateListQuery) => Promise<MandatePage>;
  listAll: (query?: Omit<MandateListQuery, "cursor" | "perPage">) => Promise<ApiMandateSummary[]>;
  get: (id: string) => Promise<ApiMandateDetail>;
  createDraft: (input: NewMandateInput) => Promise<ApiMandateDetail>;
  update: (id: string, lockVersion: number, changes: MandateChanges) => Promise<ApiMandateDetail>;
  activate: (id: string, lockVersion: number, signedOn: string, signedFileId?: string) => Promise<ApiMandateDetail>;
  suspend: (id: string, lockVersion: number) => Promise<ApiMandateDetail>;
  resume: (id: string, lockVersion: number) => Promise<ApiMandateDetail>;
  terminate: (id: string, lockVersion: number, input: TerminationInput) => Promise<ApiMandateDetail>;
  renew: (id: string, lockVersion: number, months: number) => Promise<ApiMandateDetail>;
  amendTerms: (id: string, lockVersion: number, input: TermsAmendmentInput) => Promise<ApiMandateDetail>;
  archive: (id: string) => Promise<ApiMandateDetail>;
  restore: (id: string) => Promise<ApiMandateDetail>;
  addUnit: (id: string, lockVersion: number, unit: MandateUnitInput) => Promise<ApiMandateDetail>;
  removeUnit: (id: string, lockVersion: number, mandateUnitId: string) => Promise<ApiMandateDetail>;
  endUnit: (id: string, lockVersion: number, mandateUnitId: string, endDate: string) => Promise<ApiMandateDetail>;
  endRequest: (id: string) => Promise<ApiEndRequest | null>;
  dismissEndRequest: (id: string, note: string | null) => Promise<ApiEndRequest>;
  mandants: () => Promise<ApiMandant[]>;
  parties: () => Promise<PartyOption[]>;
  units: () => Promise<UnitOption[]>;
  mandateTypes: () => Promise<MandateTypeOption[]>;
  termDefaults: () => Promise<ApiTermDefaults | null>;
  saveTermDefaults: (lockVersion: number | null, input: TermDefaultsInput) => Promise<ApiTermDefaults>;
  documents: (id: string) => Promise<ApiMandateDocument[]>;
  uploadFile: (id: string, file: File) => Promise<string>;
  shareDocument: (id: string, storedFileId: string, kind: ShareableKind) => Promise<ApiMandateDocument>;
  unshareDocument: (id: string, documentId: string) => Promise<ApiMandateDocument>;
}

const enc = encodeURIComponent;
const mandatePath = (id: string): string => `/mandates/${enc(id)}`;

export function createApiMandatesSource({ client, organizationId }: ApiMandatesSourceOptions): MandatesSource {
  const transport = createTransport(client, organizationId);
  const detail = async (request: Promise<{ data: ApiMandateDetail }>): Promise<ApiMandateDetail> => (await request).data;

  const list = async (query: MandateListQuery = {}): Promise<MandatePage> => {
    const params: Query = {
      per_page: query.perPage ?? PAGE_SIZE,
      cursor: query.cursor,
      q: query.search,
      status: query.status,
      mandant: query.mandantId,
      unit: query.unitId,
      archived: query.archived === true ? 1 : undefined,
    };
    const page = await transport.get("/mandates", apiMandatePageSchema, params);
    return { items: page.data, nextCursor: page.meta.next_cursor };
  };

  const listAll = async (query: Omit<MandateListQuery, "cursor" | "perPage"> = {}): Promise<ApiMandateSummary[]> => {
    const all: ApiMandateSummary[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await list({ ...query, cursor, perPage: PAGE_SIZE });
      all.push(...result.items);
      if (result.nextCursor === null) return all;
      cursor = result.nextCursor;
    }
    throw unsupported("Trop de mandats pour un chargement complet : affinez la recherche.");
  };

  const mandants = async (): Promise<ApiMandant[]> => {
    const all: ApiMandant[] = [];
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const { data } = await transport.get("/mandates/mandants", apiMandantListSchema, { limit: MANDANT_PAGE_SIZE, after });
      all.push(...data);
      const last = data.at(-1);
      if (data.length < MANDANT_PAGE_SIZE || last === undefined) return all;
      after = last.party_id;
    }
    throw unsupported("Trop de mandants pour un chargement complet.");
  };

  const parties = async (): Promise<PartyOption[]> => {
    const all: PartyOption[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await transport.get("/parties", apiPartyPageSchema, { per_page: PAGE_SIZE, cursor });
      for (const party of result.data) if (party.archived_at === null && !party.is_anonymized) all.push({ id: party.id, name: party.display_name, kind: party.kind });
      if (result.meta.next_cursor === null) return all;
      cursor = result.meta.next_cursor;
    }
    throw unsupported("Trop de contacts pour un chargement complet.");
  };

  const units = async (): Promise<UnitOption[]> => {
    const all: UnitOption[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await transport.get("/units", apiUnitPageSchema, { per_page: PAGE_SIZE, cursor });
      for (const unit of result.data) if (unit.archived_at === null) all.push({ id: unit.id, reference: unit.reference, propertyName: unit.property.name });
      if (result.meta.next_cursor === null) return all;
      cursor = result.meta.next_cursor;
    }
    throw unsupported("Trop de lots pour un chargement complet.");
  };

  const mandateTypes = async (): Promise<MandateTypeOption[]> => {
    const { data } = await transport.get("/catalog/vocabularies/mandate_type/terms", apiTermListSchema);
    return data
      .filter((term) => !term.archived)
      .map((term) => ({ id: term.id, key: term.key, label: term.labels.fr ?? Object.values(term.labels)[0] ?? term.key, semanticKey: term.semantic_key }));
  };

  const termDefaults = async (): Promise<ApiTermDefaults | null> => {
    try {
      return (await transport.get("/mandates/term-defaults", apiTermDefaultsResponseSchema)).data;
    } catch (error) {
      if (error instanceof MandatesApiError && error.kind === "not_found" && error.code === TERM_DEFAULTS_NOT_FOUND_CODE) return null;
      throw error;
    }
  };

  const documents = async (id: string): Promise<ApiMandateDocument[]> => {
    const all: ApiMandateDocument[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await transport.get(`${mandatePath(id)}/documents`, apiMandateDocumentPageSchema, { per_page: PAGE_SIZE, cursor });
      all.push(...result.data);
      if (result.meta.next_cursor === null) return all;
      cursor = result.meta.next_cursor;
    }
    throw unsupported("Trop de documents pour un chargement complet.");
  };

  return {
    list,
    listAll,
    get: async (id) => (await transport.get(mandatePath(id), apiMandateResponseSchema)).data,
    createDraft: (input) => detail(transport.post("/mandates", apiMandateResponseSchema, createPayload(input))),
    update: (id, lockVersion, changes) => detail(transport.patch(mandatePath(id), apiMandateResponseSchema, updatePayload(lockVersion, changes))),
    activate: (id, lockVersion, signedOn, signedFileId) =>
      detail(transport.post(`${mandatePath(id)}/activate`, apiMandateResponseSchema, activatePayload(lockVersion, signedOn, signedFileId))),
    suspend: (id, lockVersion) => detail(transport.post(`${mandatePath(id)}/suspend`, apiMandateResponseSchema, versionPayload(lockVersion))),
    resume: (id, lockVersion) => detail(transport.post(`${mandatePath(id)}/resume`, apiMandateResponseSchema, versionPayload(lockVersion))),
    terminate: (id, lockVersion, input) => detail(transport.post(`${mandatePath(id)}/terminate`, apiMandateResponseSchema, terminatePayload(lockVersion, input))),
    renew: (id, lockVersion, months) => detail(transport.post(`${mandatePath(id)}/renew`, apiMandateResponseSchema, renewPayload(lockVersion, months))),
    amendTerms: (id, lockVersion, input) => detail(transport.post(`${mandatePath(id)}/terms`, apiMandateResponseSchema, amendPayload(lockVersion, input))),
    archive: (id) => detail(transport.post(`${mandatePath(id)}/archive`, apiMandateResponseSchema)),
    restore: (id) => detail(transport.delete(`${mandatePath(id)}/archive`, apiMandateResponseSchema)),
    addUnit: (id, lockVersion, unit) => detail(transport.post(`${mandatePath(id)}/units`, apiMandateResponseSchema, addUnitPayload(lockVersion, unit))),
    removeUnit: (id, lockVersion, mandateUnitId) =>
      detail(transport.delete(`${mandatePath(id)}/units/${enc(mandateUnitId)}?lock_version=${String(lockVersion)}`, apiMandateResponseSchema)),
    endUnit: (id, lockVersion, mandateUnitId, endDate) =>
      detail(transport.post(`${mandatePath(id)}/units/${enc(mandateUnitId)}/end`, apiMandateResponseSchema, endUnitPayload(lockVersion, endDate))),
    endRequest: async (id) => (await transport.get(`${mandatePath(id)}/end-request`, apiEndRequestResponseSchema)).data,
    dismissEndRequest: async (id, note) =>
      (await transport.post(`${mandatePath(id)}/end-request/dismiss`, apiEndRequestDismissedSchema, note === null ? {} : { note })).data,
    mandants,
    parties,
    units,
    mandateTypes,
    termDefaults,
    saveTermDefaults: async (lockVersion, input) =>
      (await transport.put("/mandates/term-defaults", apiTermDefaultsResponseSchema, termDefaultsPayload(lockVersion, input))).data,
    documents,
    uploadFile: async (id, file) => (await transport.post("/documents/files", apiStoredFileResponseSchema, mandateFileForm(file, id))).data.id,
    shareDocument: async (id, storedFileId, kind) =>
      (await transport.post(`${mandatePath(id)}/documents`, apiMandateDocumentResponseSchema, shareDocumentPayload(storedFileId, kind))).data,
    unshareDocument: async (id, documentId) => (await transport.delete(`${mandatePath(id)}/documents/${enc(documentId)}`, apiMandateDocumentResponseSchema)).data,
  };
}
