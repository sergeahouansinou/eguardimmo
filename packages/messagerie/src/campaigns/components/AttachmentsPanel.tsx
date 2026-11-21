'use client';

import { Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Button, Icon } from '@eguardimmo/ui';
import { AttachmentChip } from '../../components/attachments';
import { campaignErrorMessage } from '../api/errors';
import { attachmentIssue } from '../inputs';
import { MAX_CAMPAIGN_ATTACHMENTS } from '../model';
import type { CampaignAttachment } from '../model';
import { useAddAttachment, useDownloadAttachment, useRemoveAttachment } from '../queries';

export interface AttachmentsPanelProps {
  campaignId: string;
  attachments: readonly CampaignAttachment[];
  editable: boolean;
}

export function AttachmentsPanel({ campaignId, attachments, editable }: AttachmentsPanelProps) {
  const add = useAddAttachment(campaignId);
  const remove = useRemoveAttachment(campaignId);
  const download = useDownloadAttachment(campaignId);
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = add.isPending || remove.isPending;

  const upload = async (files: File[]) => {
    setProblem(null);
    let count = attachments.length;
    for (const file of files) {
      const issue = attachmentIssue(file, count, MAX_CAMPAIGN_ATTACHMENTS);
      if (issue !== null) {
        setProblem(issue);
        return;
      }
      try {
        await add.mutateAsync(file);
        count += 1;
      } catch (error) {
        setProblem(campaignErrorMessage(error));
        return;
      }
    }
  };

  return (
    <section aria-label="Pièces jointes" className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-fg">{`Pièces jointes (${String(attachments.length)}/${String(MAX_CAMPAIGN_ATTACHMENTS)})`}</h2>
        {editable ? (
          <>
            <input
              ref={input}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              aria-label="Choisir des fichiers PDF"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                void upload(files);
              }}
            />
            <Button variant="secondary" size="sm" loading={add.isPending} disabled={busy || attachments.length >= MAX_CAMPAIGN_ATTACHMENTS} onClick={() => { input.current?.click(); }}>
              <Icon icon={Paperclip} />
              Ajouter un PDF
            </Button>
          </>
        ) : null}
      </div>
      {attachments.length === 0 ? (
        <p className="text-caption text-fg-subtle">{editable ? 'Aucune pièce jointe. PDF uniquement, 5 Mo au plus, 3 pièces au maximum.' : 'Aucune pièce jointe.'}</p>
      ) : (
        <ul aria-label="Pièces de la campagne" className="flex flex-wrap gap-1.5">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex max-w-full min-w-0">
              <AttachmentChip
                name={attachment.name}
                sizeBytes={attachment.sizeBytes}
                mimeType="application/pdf"
                onOpen={() => {
                  setProblem(null);
                  download.mutate(attachment, { onError: (error) => { setProblem(campaignErrorMessage(error)); } });
                }}
                {...(editable
                  ? {
                      onRemove: () => {
                        setProblem(null);
                        remove.mutate(attachment.id, { onError: (error) => { setProblem(campaignErrorMessage(error)); } });
                      },
                    }
                  : {})}
              />
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-fg-subtle">Les destinataires avec un compte reçoivent un lien vers leur espace ; les autres reçoivent la pièce par e-mail.</p>
      {problem ? <Alert tone="danger" title="Pièce jointe refusée">{problem}</Alert> : null}
    </section>
  );
}
