'use client';

import { Plus, Undo2 } from 'lucide-react';
import { Badge, Button, Card, CardHeader, CardTitle, Icon, IconButton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import { creancesActives, resteCreance } from '../derive';
import type { Dossier, FinancesData } from '../schemas';

export function CreancesCard({ data, dossier, money, onAdd, onRemove }: { data: FinancesData; dossier: Dossier; money: (minor: number) => string; onAdd: () => void; onRemove: (creanceId: string) => void }) {
  const actives = creancesActives(dossier);
  const retirees = dossier.creances.filter((creance) => creance.retireLe !== null);
  return (
    <Card aria-labelledby="re-creances">
      <CardHeader className="flex-wrap">
        <CardTitle as="h2" id="re-creances">Créances du dossier</CardTitle>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Icon icon={Plus} />
          Ajouter des créances
        </Button>
      </CardHeader>
      <Table aria-label="Créances du dossier">
        <TableHead>
          <tr>
            <TableHeaderCell>Créance</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Incluse le</TableHeaderCell>
            <TableHeaderCell numeric>Dû à l’inclusion</TableHeaderCell>
            <TableHeaderCell numeric>Reste dû</TableHeaderCell>
            <TableHeaderCell>Action</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {actives.map((creance) => (
            <TableRow key={creance.id}>
              <TableCell strong>{creance.libelle}</TableCell>
              <TableCell>{creance.kind === 'echeance' ? 'Échéance de loyer' : 'Facture'}</TableCell>
              <TableCell>{formatDate(creance.inclusLe)}</TableCell>
              <TableCell numeric>{money(creance.montantInitial)}</TableCell>
              <TableCell numeric className="font-semibold text-fg-danger">{money(resteCreance(data, creance))}</TableCell>
              <TableCell>
                <IconButton label={`Retirer ${creance.libelle} du dossier`} icon={Undo2} disabled={actives.length === 1} onClick={() => { onRemove(creance.id); }} />
              </TableCell>
            </TableRow>
          ))}
          {retirees.map((creance) => (
            <TableRow key={creance.id}>
              <TableCell className="text-fg-subtle">{creance.libelle}</TableCell>
              <TableCell>{creance.kind === 'echeance' ? 'Échéance de loyer' : 'Facture'}</TableCell>
              <TableCell>{formatDate(creance.inclusLe)}</TableCell>
              <TableCell numeric>{money(creance.montantInitial)}</TableCell>
              <TableCell numeric>—</TableCell>
              <TableCell>
                <Badge>Retirée le {formatDate(creance.retireLe ?? creance.inclusLe)}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-caption text-fg-subtle">
        {actives.length} créance{actives.length > 1 ? 's' : ''} dans le dossier. Une créance retirée reste visible à l’historique.
      </p>
    </Card>
  );
}
