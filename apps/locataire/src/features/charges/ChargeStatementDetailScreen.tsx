'use client';

import { Alert } from '@eguardimmo/ui';
import { SectionCard } from '@/components/Section';
import { CHARGE_WORDING, SUPERSEDED_NOTICE, settlementText } from '@/tenant/chargeLabels';
import type { ChargeStatement } from '@/tenant/chargeModel';
import { useChargeDownload, useChargeStatement } from '@/tenant/chargeQueries';
import { DetailState } from '../rent/NotFound';
import { apiChargesView } from './apiChargesView';
import { ChargeDownloadFailure, ChargeFilesCard, ChargePdfButton } from './ChargeDownloads';
import { ChargesDocument } from './ChargesDocument';

export function ChargeStatementDetailScreen({ id }: { id: string }) {
  const statement = useChargeStatement(id);
  return (
    <DetailState
      query={statement}
      notFound={{ title: 'Décompte introuvable', backHref: '/loyers/regularisation', backLabel: 'Retour à mes décomptes de charges' }}
      failureTitle="Ce décompte n’a pas pu être chargé"
      wording={CHARGE_WORDING}
    >
      {(data) => <StatementContent statement={data} />}
    </DetailState>
  );
}

function StatementContent({ statement }: { statement: ChargeStatement }) {
  const downloads = useChargeDownload();
  return (
    <ChargesDocument
      view={apiChargesView(statement)}
      actions={<ChargePdfButton statement={statement} downloads={downloads} />}
      notice={
        <>
          {statement.status === 'superseded' ? (
            <Alert tone="warning" title="Décompte remplacé">
              {SUPERSEDED_NOTICE}
            </Alert>
          ) : null}
          <ChargeDownloadFailure downloads={downloads} />
        </>
      }
      aside={
        <>
          {statement.settlement === null ? null : (
            <SectionCard id="rc-reglement" title="Règlement du solde">
              <p className="text-body text-fg">{settlementText(statement.settlement, statement.notBefore)}</p>
            </SectionCard>
          )}
          <ChargeFilesCard statement={statement} downloads={downloads} />
        </>
      }
    />
  );
}
