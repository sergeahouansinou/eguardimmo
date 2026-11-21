import { mockAccessApi } from '../../../locataires/access/api/testing';
import { ORG } from './responses.fixtures';

export const mockLegalApi = mockAccessApi;
export const legalUrl = `/api/v1/org/${ORG}/legal-identity`;
export const orgUrl = `/api/v1/org/${ORG}`;
