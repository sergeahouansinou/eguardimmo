'use client';

import { useCallback, useState } from 'react';
import type { CampaignDetail, MarketingOptions } from '@/platform/marketing/marketing';
import { useNotify } from '@/ui/notify';
import { draftOf, emptyDraft, inputOf, isDirty, validateDraft } from '../campaignDraft';
import type { CampaignDraft, DraftErrors } from '../campaignDraft';
import { useReloadCampaign, useSaveCampaign } from '../hooks';
import { campaignProblem } from '../labels';
import type { CampaignProblem } from '../labels';

export interface CampaignFormSetup {
  campaign: CampaignDetail | null;
  options: MarketingOptions;
  initialUnknown: readonly string[];
  onCreated: (campaign: CampaignDetail, unknownRecipients: string[]) => void;
}

export function useCampaignForm({ campaign, options, initialUnknown, onCreated }: CampaignFormSetup) {
  const notify = useNotify();
  const [saved, setSaved] = useState(campaign);
  const [baseline, setBaseline] = useState(() => (campaign ? draftOf(campaign) : emptyDraft(options)));
  const [draft, setDraft] = useState(baseline);
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<CampaignProblem | null>(null);
  const [unknownRecipients, setUnknownRecipients] = useState(initialUnknown);
  const saveCampaign = useSaveCampaign();
  const reloadCampaign = useReloadCampaign();

  const change = useCallback((changes: Partial<CampaignDraft>) => { setDraft((current) => ({ ...current, ...changes })); }, []);

  const apply = (next: CampaignDetail) => {
    const fresh = draftOf(next);
    setSaved(next);
    setBaseline(fresh);
    setDraft(fresh);
    setAttempted(false);
    setFailure(null);
  };

  const errors: DraftErrors = attempted ? validateDraft(draft, options, saved?.images ?? []) : {};

  const save = async () => {
    setAttempted(true);
    setFailure(null);
    if (Object.keys(validateDraft(draft, options, saved?.images ?? [])).length > 0) return;
    try {
      const result = await saveCampaign.mutateAsync({
        input: inputOf(draft, options),
        target: saved ? { id: saved.id, lockVersion: saved.lock_version } : null,
      });
      notify.success('Campagne enregistrée');
      setUnknownRecipients(result.unknownRecipients);
      if (saved) apply(result.campaign);
      else onCreated(result.campaign, result.unknownRecipients);
    } catch (error) {
      setFailure(campaignProblem(error));
    }
  };

  const reload = async () => {
    if (!saved) return;
    try {
      apply(await reloadCampaign.mutateAsync(saved.id));
      setUnknownRecipients([]);
    } catch (error) {
      setFailure(campaignProblem(error));
    }
  };

  return {
    saved,
    draft,
    errors,
    failure,
    unknownRecipients,
    dirty: saved === null || isDirty(draft, baseline),
    invalid: Object.keys(errors).length > 0,
    saving: saveCampaign.isPending,
    reloading: reloadCampaign.isPending,
    change,
    save,
    reload,
    fail: setFailure,
  };
}
