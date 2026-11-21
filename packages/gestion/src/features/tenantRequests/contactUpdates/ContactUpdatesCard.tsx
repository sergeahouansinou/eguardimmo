'use client';

import { Badge, IconButton } from '@eguardimmo/ui';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../../finances/rent/CursorPager';
import { SectionCard, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { canManage, useTenantRequestsPermissions } from '../shared/access';
import { ConfirmAction } from '../shared/parts/ConfirmAction';
import { QueryState } from '../shared/parts/QueryState';
import { useApplyContactUpdate, useContactUpdates, useDismissContactUpdate } from './hooks';
import { contactUpdateBadge } from './model';
import type { ContactUpdate } from './model';

export function ContactUpdatesCard({ partyId }: { partyId: string }) {
  const permissions = useTenantRequestsPermissions();
  if (!canManage(permissions)) return null;
  return <ContactUpdatesContent partyId={partyId} />;
}

type Pending = { kind: 'apply' | 'dismiss'; update: ContactUpdate } | null;

function ContactUpdatesContent({ partyId }: { partyId: string }) {
  const pages = useCursorPages();
  const updates = useContactUpdates(partyId, pages.cursor);
  const apply = useApplyContactUpdate();
  const dismiss = useDismissContactUpdate();
  const notify = useNotify();
  const [pending, setPending] = useState<Pending>(null);
  const close = () => { setPending(null); };

  return (
    <SectionCard id="contact-updates" title="Demandes de modification de coordonnées">
      {updates.data === undefined ? (
        <QueryState query={updates} label="Chargement des demandes de modification" title="Impossible de charger les demandes de modification" />
      ) : updates.data.items.length === 0 ? (
        <p className="text-body text-fg-subtle">Aucune demande. Le locataire peut vous transmettre le changement de son e-mail ou de son téléphone depuis son espace.</p>
      ) : (
        <>
          <ul aria-label="Demandes de modification de coordonnées" className="flex flex-col">
            {updates.data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
                <span className="flex min-w-0 flex-col text-body">
                  {item.email === null && item.phone === null ? <span className="text-fg-subtle">Valeurs effacées après la décision</span> : null}
                  {item.email === null ? null : <span className="break-all text-fg">{`E-mail : ${item.email}`}</span>}
                  {item.phone === null ? null : <span className="text-fg">{`Téléphone : ${item.phone}`}</span>}
                  <span className="text-caption text-fg-subtle">{`Demandée le ${formatDateFr(item.requestedAt)}${item.decidedAt === null ? '' : `, traitée le ${formatDateFr(item.decidedAt)}`}`}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Badge tone={contactUpdateBadge[item.status].tone}>{contactUpdateBadge[item.status].label}</Badge>
                  {item.status === 'pending' ? (
                    <>
                      <IconButton label="Appliquer la demande de modification" icon={Check} onClick={() => { setPending({ kind: 'apply', update: item }); }} />
                      <IconButton label="Écarter la demande de modification" icon={X} variant="danger" onClick={() => { setPending({ kind: 'dismiss', update: item }); }} />
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <CursorPager pages={pages} nextCursor={updates.data.nextCursor} label="Pagination des demandes de modification" />
        </>
      )}
      <ConfirmAction
        open={pending?.kind === 'apply'}
        title="Appliquer cette demande ?"
        description="Les valeurs proposées deviennent la coordonnée principale de la fiche du locataire. Elles sont effacées de la demande dès la décision."
        confirmLabel="Appliquer"
        failureTitle="Demande non appliquée"
        run={async () => {
          if (pending === null) return;
          await apply.mutateAsync({ partyId, id: pending.update.id });
          notify({ title: 'Demande appliquée', description: 'La fiche du locataire est à jour.' });
        }}
        onClose={close}
      />
      <ConfirmAction
        open={pending?.kind === 'dismiss'}
        title="Écarter cette demande ?"
        description="La fiche du locataire reste inchangée. Les valeurs proposées sont effacées de la demande."
        confirmLabel="Écarter"
        tone="danger"
        failureTitle="Demande non écartée"
        run={async () => {
          if (pending === null) return;
          await dismiss.mutateAsync({ partyId, id: pending.update.id });
          notify({ title: 'Demande écartée', description: 'La fiche du locataire est inchangée.' });
        }}
        onClose={close}
      />
    </SectionCard>
  );
}
