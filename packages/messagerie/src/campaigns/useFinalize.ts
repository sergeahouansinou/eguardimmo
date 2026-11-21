'use client';

import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { describeCampaignFailure } from './api/errors';
import type { CampaignFailure } from './api/errors';
import { useCampaignsConfig } from './context';
import type { Campaign, CampaignDraftInput } from './model';
import { useScheduleCampaign, useSaveCampaign, useSendCampaign } from './queries';

export type FinalizeAction = { kind: 'send' } | { kind: 'schedule'; scheduledAt: string };

export interface EditorSession {
  current: Campaign | null;
  setCurrent: (campaign: Campaign) => void;
  draft: () => CampaignDraftInput;
}

export interface Finalizer {
  busy: boolean;
  proofDialog: ReactNode;
  failure: CampaignFailure | null;
  clearFailure: () => void;
  save: () => Promise<Campaign | null>;
  saving: boolean;
  finalize: (action: FinalizeAction, onIntercepted: () => void) => Promise<void>;
}

export function useFinalize({ current, setCurrent, draft }: EditorSession): Finalizer {
  const { navigate, routes, useProof } = useCampaignsConfig();
  const proof = useProof();
  const saveMutation = useSaveCampaign();
  const send = useSendCampaign();
  const schedule = useScheduleCampaign();
  const latest: RefObject<Campaign | null> = useRef(current);
  latest.current = current;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<CampaignFailure | null>(null);

  const persist = async (): Promise<Campaign> => {
    const base = latest.current;
    const saved = await saveMutation.mutateAsync({ id: base?.id ?? null, lockVersion: base?.lockVersion ?? null, input: draft() });
    latest.current = saved;
    setCurrent(saved);
    return saved;
  };

  const save = async (): Promise<Campaign | null> => {
    setFailure(null);
    try {
      return await persist();
    } catch (error) {
      setFailure(describeCampaignFailure(error));
      return null;
    }
  };

  const finalize = async (action: FinalizeAction, onIntercepted: () => void): Promise<void> => {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await persist();
      const done = action.kind === 'send' ? await send.mutateAsync(saved.id) : await schedule.mutateAsync({ id: saved.id, scheduledAt: action.scheduledAt });
      setBusy(false);
      navigate(routes.detail(done.id));
    } catch (error) {
      const replay = () => { void finalize(action, onIntercepted); };
      if (proof.intercept(error, replay, () => { setBusy(false); })) {
        onIntercepted();
        return;
      }
      setBusy(false);
      setFailure(describeCampaignFailure(error));
    }
  };

  return { busy, proofDialog: proof.dialog, failure, clearFailure: () => { setFailure(null); }, save, saving: saveMutation.isPending, finalize };
}
