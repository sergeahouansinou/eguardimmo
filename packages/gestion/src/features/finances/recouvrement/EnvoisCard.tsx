'use client';

import { Badge, Button, Card, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import type { Transmission } from '../schemas';
import { EmptyBlock } from '../parts';
import { transmissionStatut, TRANSMISSION_STATUTS } from './transmissions';

export function EnvoisCard({
  transmissions,
  today,
  onRevoke,
  onResend,
}: {
  transmissions: readonly Transmission[];
  today: string;
  onRevoke: (transmission: Transmission) => void;
  onResend: (transmission: Transmission) => void;
}) {
  return (
    <Card aria-labelledby="re-envois">
      <CardHeader>
        <CardTitle as="h2" id="re-envois">Envois</CardTitle>
      </CardHeader>
      {transmissions.length === 0 ? (
        <EmptyBlock title="Aucun envoi">Générez l’envoi des pièces puis transmettez-le au commissaire de justice.</EmptyBlock>
      ) : (
        <Table aria-label="Historique des envois">
          <TableHead>
            <tr>
              <TableHeaderCell>Destinataire</TableHeaderCell>
              <TableHeaderCell>Envoyé le</TableHeaderCell>
              <TableHeaderCell>Expire le</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell numeric>Téléchargements</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {[...transmissions].reverse().map((transmission) => {
              const statut = transmissionStatut(transmission, today);
              const badge = TRANSMISSION_STATUTS[statut];
              return (
                <TableRow key={transmission.id}>
                  <TableCell strong>
                    {transmission.destinataire}
                    <span className="block text-caption font-normal text-fg-subtle">{transmission.email}</span>
                  </TableCell>
                  <TableCell>{formatDate(transmission.envoyeLe)}</TableCell>
                  <TableCell>{formatDate(transmission.expireLe)}</TableCell>
                  <TableCell>
                    <Badge tone={badge.tone}>{badge.label}{transmission.revoqueLe ? ` le ${formatDate(transmission.revoqueLe)}` : ''}</Badge>
                  </TableCell>
                  <TableCell numeric>{transmission.telechargements}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      {statut === 'actif' ? (
                        <Button variant="link" size="sm" onClick={() => { onRevoke(transmission); }}>
                          Révoquer
                        </Button>
                      ) : null}
                      <Button variant="link" size="sm" onClick={() => { onResend(transmission); }}>
                        Renvoyer un lien
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
