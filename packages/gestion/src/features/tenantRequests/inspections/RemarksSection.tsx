'use client';

import { Badge, Button, Icon } from '@eguardimmo/ui';
import { MessageSquareReply } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../../finances/rent/CursorPager';
import { ListLoading, LoadError, NoRows, SectionCard } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { useLeaseLabels } from '../shared/hooks';
import { AnswerDialog } from './AnswerDialog';
import { useInspectionRemarks } from './hooks';
import { answerLabel, remarkKindLabel, remarkStatusBadge } from './model';
import type { Inspection, Remark } from './model';
import { RemarkPhotos } from './RemarkPhotos';

export function RemarksSection({ inspection }: { inspection: Inspection }) {
  const pages = useCursorPages();
  const remarks = useInspectionRemarks(inspection.id, pages.cursor);
  const labels = useLeaseLabels([inspection.leaseId]);
  const [answering, setAnswering] = useState<Remark | null>(null);

  return (
    <SectionCard id="inspection-remarks" title="Remarques du locataire">
      {remarks.isPending ? <ListLoading label="Chargement des remarques" /> : null}
      {remarks.isError ? <LoadError title="Impossible de charger les remarques" /> : null}
      {remarks.data?.items.length === 0 ? <NoRows>{inspection.publishedAt === null ? 'Les locataires pourront ajouter des remarques une fois l’état des lieux publié.' : 'Aucune remarque pour le moment.'}</NoRows> : null}
      {remarks.data && remarks.data.items.length > 0 ? (
        <ul className="flex flex-col">
          {remarks.data.items.map((remark) => {
            const badge = remarkStatusBadge[remark.status];
            return (
              <li key={remark.id} className="flex flex-col gap-1.5 border-t border-line py-3 first:border-t-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-body-strong text-fg">{labels.tenantOf(inspection.leaseId, remark.partyId)}</b>
                  <Badge tone="neutral">{remarkKindLabel[remark.kind]}</Badge>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  <span className="text-caption text-fg-subtle">{formatDateFr(remark.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-body text-fg">{remark.body}</p>
                <RemarkPhotos photos={remark.photos} />
                {remark.answer !== null && remark.answerBody !== null ? (
                  <p className="rounded-md bg-muted p-2 text-body text-fg">
                    <b>{`${answerLabel[remark.answer]} : `}</b>
                    <span className="whitespace-pre-wrap break-words">{remark.answerBody}</span>
                  </p>
                ) : (
                  <div>
                    <Button variant="secondary" size="sm" onClick={() => { setAnswering(remark); }}>
                      <Icon icon={MessageSquareReply} />
                      Répondre
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {remarks.data ? <CursorPager pages={pages} nextCursor={remarks.data.nextCursor} label="Pagination des remarques" /> : null}
      {answering === null ? null : <AnswerDialog remark={answering} open onClose={() => { setAnswering(null); }} />}
    </SectionCard>
  );
}
