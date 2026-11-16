'use client';

import { Check, FilePlus, FolderOpen, MessageSquare, Star, X } from 'lucide-react';
import { ConfirmDialog } from '@eguardimmo/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useConvertCandidate, useSetCandidateStatus } from './hooks';
import { errorMessage, useGestionNavigation, useNotify } from './kit';
import type { ActionItem } from './kit';
import { links } from './kit/links';
import { locatairesPaths } from './paths';
import type { Candidate, CandidateStatus } from './schemas';

export const candidateStatusBadge: Record<CandidateStatus, { label: string; tone: 'warning' | 'info' | 'success' | 'danger' }> = {
  en_attente: { label: 'En attente', tone: 'warning' },
  preselection: { label: 'Présélection', tone: 'info' },
  confirme: { label: 'Confirmée', tone: 'success' },
  refuse: { label: 'Refusée', tone: 'danger' },
};

export function useCandidateActions(): { actionsFor: (candidate: Candidate, includeDossier?: boolean) => ActionItem[]; dialogs: ReactNode } {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const setStatus = useSetCandidateStatus();
  const convert = useConvertCandidate();
  const [refusing, setRefusing] = useState<Candidate | null>(null);

  const change = async (candidate: Candidate, status: CandidateStatus, title: string) => {
    try {
      await setStatus.mutateAsync({ id: candidate.id, status });
      notify({ title, description: `${candidate.firstName} ${candidate.lastName}` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

  const createLease = async (candidate: Candidate) => {
    try {
      const tenant = await convert.mutateAsync(candidate.id);
      push(links.newLease({ locataire: tenant.id, bien: candidate.unitId }));
    } catch (error) {
      notify({ tone: 'danger', title: 'Création du bail impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (candidate: Candidate, includeDossier = true): ActionItem[] => [
    ...(includeDossier ? [{ id: 'dossier', label: 'Voir le dossier', icon: FolderOpen, onSelect: () => { push(locatairesPaths.candidate(candidate.id)); } }] : []),
    {
      id: 'preselect',
      label: 'Présélectionner',
      icon: Star,
      disabled: candidate.status !== 'en_attente',
      onSelect: () => { void change(candidate, 'preselection', 'Candidat présélectionné'); },
    },
    {
      id: 'confirm',
      label: 'Confirmer',
      icon: Check,
      disabled: candidate.status === 'confirme' || candidate.status === 'refuse',
      onSelect: () => { void change(candidate, 'confirme', 'Candidat confirmé'); },
    },
    { id: 'lease', label: 'Créer le bail', icon: FilePlus, disabled: candidate.status !== 'confirme', onSelect: () => { void createLease(candidate); } },
    { id: 'message', label: 'Envoyer un message', icon: MessageSquare, onSelect: () => { push(links.newMessage(candidate.tenantId ?? undefined)); } },
    { id: 'refuse', label: 'Refuser', icon: X, tone: 'danger', separatorBefore: true, disabled: candidate.status === 'refuse', onSelect: () => { setRefusing(candidate); } },
  ];

  const dialogs = (
    <ConfirmDialog
      open={refusing !== null}
      onOpenChange={(open) => { if (!open) setRefusing(null); }}
      title="Refuser ce candidat ?"
      description={refusing ? `${refusing.firstName} ${refusing.lastName} sera marqué comme refusé. Vous pourrez toujours consulter son dossier.` : ''}
      confirmLabel="Refuser"
      tone="danger"
      onConfirm={() => {
        const target = refusing;
        setRefusing(null);
        if (target) void change(target, 'refuse', 'Candidat refusé');
      }}
    />
  );

  return { actionsFor, dialogs };
}
