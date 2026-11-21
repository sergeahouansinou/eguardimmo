'use client';

import { Badge, IconButton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Ban, Send } from 'lucide-react';
import { useState } from 'react';
import { NoteDialog } from './NoteDialog';
import { ResendDialog } from './ResendDialog';
import { useResend, useRevoke } from './hooks';
import { transmissionBadge } from './labels';
import type { Transmission } from './model';
import { DEFAULT_VALID_DAYS } from './ValiditySelect';
import { errorMessage, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

type Pending = { kind: 'revoke' | 'resend'; transmission: Transmission } | null;

const day = (iso: string | null): string => (iso === null ? '—' : formatDateFr(iso.slice(0, 10)));

export function TransmissionsTable({ transmissions, editable }: { transmissions: readonly Transmission[]; editable: boolean }) {
  const notify = useNotify();
  const revoke = useRevoke();
  const resend = useResend();
  const [pending, setPending] = useState<Pending>(null);
  const [days, setDays] = useState(String(DEFAULT_VALID_DAYS));
  const target = pending?.transmission;

  const doRevoke = async (transmission: Transmission, reason: string) => {
    try {
      await revoke.mutateAsync({ transmissionId: transmission.id, reason });
      notify({ title: 'Lien révoqué', description: `Le lien envoyé à ${transmission.recipientEmail} ne fonctionne plus.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Révocation impossible', description: errorMessage(error) });
    } finally {
      setPending(null);
    }
  };

  const doResend = async (transmission: Transmission) => {
    try {
      const sent = await resend.mutateAsync({ transmissionId: transmission.id, validDays: Number(days) });
      notify({ title: 'Nouveau lien envoyé', description: `Nouveau lien envoyé à ${sent.recipientEmail}, valable jusqu’au ${day(sent.expiresAt)}. L’ancien est révoqué.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Renvoi impossible', description: errorMessage(error) });
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <Table aria-label="Historique des transmissions">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Destinataire</TableHeaderCell>
            <TableHeaderCell>Envoyé le</TableHeaderCell>
            <TableHeaderCell>Expire le</TableHeaderCell>
            <TableHeaderCell numeric>Téléchargements</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
            <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transmissions.map((transmission) => {
            const badge = transmissionBadge[transmission.state];
            return (
              <TableRow key={transmission.id}>
                <TableCell strong>{transmission.recipientEmail}</TableCell>
                <TableCell>{day(transmission.sentAt)}</TableCell>
                <TableCell>{day(transmission.expiresAt)}</TableCell>
                <TableCell numeric>{transmission.downloadCount === 0 ? '0' : `${String(transmission.downloadCount)} (le ${day(transmission.firstDownloadedAt)})`}</TableCell>
                <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
                <TableCell>
                  {editable ? (
                    <span className="flex items-center gap-1">
                      <IconButton label={`Renvoyer le lien à ${transmission.recipientEmail}`} icon={Send} onClick={() => { setDays(String(DEFAULT_VALID_DAYS)); setPending({ kind: 'resend', transmission }); }} />
                      {transmission.state === 'active' ? <IconButton label={`Révoquer le lien envoyé à ${transmission.recipientEmail}`} icon={Ban} variant="danger" onClick={() => { setPending({ kind: 'revoke', transmission }); }} /> : null}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <NoteDialog
        open={pending?.kind === 'revoke'}
        title="Révoquer le lien ?"
        description={target ? `Le lien envoyé à ${target.recipientEmail} cessera immédiatement de fonctionner. La révocation est inscrite au carnet.` : ''}
        confirmLabel="Révoquer le lien"
        placeholder="Ex. Envoyé à la mauvaise étude"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={(reason) => { if (target) void doRevoke(target, reason); }}
        onClose={() => { setPending(null); }}
      />
      <ResendDialog
        open={pending?.kind === 'resend'}
        recipientEmail={target?.recipientEmail ?? ''}
        days={days}
        loading={resend.isPending}
        onDaysChange={setDays}
        onConfirm={() => { if (target) void doResend(target); }}
        onClose={() => { setPending(null); }}
      />
    </>
  );
}
