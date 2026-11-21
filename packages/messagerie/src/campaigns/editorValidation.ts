import { fieldErrors } from '../components/formErrors';
import type { FieldErrors } from '../components/formErrors';
import { campaignDraftSchema, campaignSendSchema, mergeFieldIssue } from './inputs';
import type { CampaignAudienceKind } from './model';

export type BuildingScope = 'all' | 'some';

export interface EditorValues {
  subject: string;
  body: string;
  audience: CampaignAudienceKind;
  buildingIds: string[];
  copyToHistory: boolean;
  scope: BuildingScope;
}

export function validateEditor(values: EditorValues, strict: boolean): FieldErrors {
  const { scope, ...input } = values;
  const parsed = (strict ? campaignSendSchema : campaignDraftSchema).safeParse(input);
  const found: FieldErrors = parsed.success ? {} : fieldErrors(parsed.error);
  const subjectIssue = mergeFieldIssue(values.subject, values.audience);
  const bodyIssue = mergeFieldIssue(values.body, values.audience);
  if (subjectIssue !== null && found.subject === undefined) found.subject = subjectIssue;
  if (bodyIssue !== null && found.body === undefined) found.body = bodyIssue;
  if (values.audience === 'tenants' && scope === 'some' && values.buildingIds.length === 0) found.buildingIds = 'Ajoutez au moins un immeuble';
  return found;
}
