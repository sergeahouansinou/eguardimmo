'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { Async } from '@/components/ScreenState';
import { useCharges } from '@/data/queries';
import type { ChargesStatement } from '@/data/schemas/loyers';
import { downloadDemoPdf } from '@eguardimmo/shell';
import { formatAmount } from '@/lib/money';
import { ChargesDocument } from '../charges/ChargesDocument';
import { demoChargesView } from '../charges/demoChargesView';

export function ChargesScreen() {
  const charges = useCharges();
  return (
    <Async query={charges} errorTitle="Le décompte de charges n’a pas pu être chargé">
      {(data) => <ChargesContent data={data} />}
    </Async>
  );
}

function ChargesContent({ data }: { data: ChargesStatement }) {
  return (
    <ChargesDocument
      view={demoChargesView(data)}
      actions={
        <Button
          onClick={() => {
            downloadDemoPdf(`decompte-charges-${String(data.year)}.pdf`, `Décompte de charges ${String(data.year)}`, [
              `Provisions versees : ${formatAmount(data.provisionsPaidCents)} EUR`,
              `Charges reelles : ${formatAmount(data.actualCents)} EUR`,
              `Solde : ${formatAmount(data.balanceCents)} EUR`,
            ]);
          }}
        >
          <Icon icon={Download} />
          Télécharger le décompte
        </Button>
      }
    />
  );
}
