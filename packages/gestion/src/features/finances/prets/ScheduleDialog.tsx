'use client';

import { Button, Dialog, DialogClose, DialogContent, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import type { ScheduleLine } from './schedule';

export function ScheduleDialog({
  open,
  title,
  lignes,
  estimated,
  money,
  onExport,
  onClose,
}: {
  open: boolean;
  title: string;
  lignes: readonly ScheduleLine[];
  estimated: boolean;
  money: (minor: number) => string;
  onExport: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        title={title}
        description={estimated ? 'Estimation à partir du capital restant dû et du taux. Importez le tableau de la banque pour un échéancier exact.' : 'Échéancier importé depuis la banque.'}
        className="max-w-[720px]"
      >
        <div className="flex flex-col gap-3 p-4">
          {lignes.length === 0 ? (
            <p className="text-body text-fg-muted">Aucune échéance à venir.</p>
          ) : (
            <div className="max-h-[50vh] overflow-auto">
              <Table aria-label="Échéances du prêt">
                <TableHead>
                  <tr>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell numeric>Mensualité</TableHeaderCell>
                    <TableHeaderCell numeric>Intérêts</TableHeaderCell>
                    <TableHeaderCell numeric>Capital</TableHeaderCell>
                    <TableHeaderCell numeric>Restant dû</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {lignes.map((ligne) => (
                    <TableRow key={ligne.date}>
                      <TableCell>{formatDate(ligne.date)}</TableCell>
                      <TableCell numeric>{money(ligne.mensualite)}</TableCell>
                      <TableCell numeric>{money(ligne.interets)}</TableCell>
                      <TableCell numeric>{money(ligne.capital)}</TableCell>
                      <TableCell numeric>{money(ligne.restant)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={lignes.length === 0} onClick={onExport}>
              Exporter l’échéancier
            </Button>
            <DialogClose asChild>
              <Button>Terminé</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
