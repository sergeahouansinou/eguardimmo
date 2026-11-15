'use client';

import { usePrepareExitEdl } from './hooks';
import { bauxPaths } from './paths';
import { edlTypeLabel } from './schemas';
import type { Edl } from './schemas';
import { useCreateSignature } from '../courriers/hooks';
import { BAILLEUR } from '../courriers/DocumentViewer';
import { courriersPaths } from '../courriers/paths';
import { useTenants } from '../locataires/hooks';
import { errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { useLeaseLookups } from './BauxParts';

export function useEdlActions() {
  const lookups = useLeaseLookups();
  const tenants = useTenants();
  const notify = useNotify();
  const { push } = useGestionNavigation();
  const requestSignature = useCreateSignature();
  const prepareExit = usePrepareExitEdl();

  const sendForSignature = async (edl: Edl) => {
    const tenant = tenants.data?.find((entry) => entry.id === edl.tenantId);
    const signers = [
      ...(tenant ? [{ name: lookups.tenantName(tenant.id), email: tenant.email }] : []),
      { name: BAILLEUR.name, email: BAILLEUR.email },
    ];
    try {
      const request = await requestSignature.mutateAsync({ title: `État des lieux ${edlTypeLabel[edl.type].toLowerCase()}, ${lookups.unitShort(edl.unitId)}`, fileName: `${edl.reference.toLowerCase()}.pdf`, signers });
      noticeAfterNavigation({ title: 'Demande de signature créée', description: `${request.reference}, ${String(request.signers.length)} signataire${request.signers.length > 1 ? 's' : ''}.` });
      push(courriersPaths.signatures);
    } catch (error) {
      notify({ tone: 'danger', title: 'Envoi impossible', description: errorMessage(error) });
    }
  };

  const prepareExitState = async (edl: Edl) => {
    try {
      const created = await prepareExit.mutateAsync(edl.id);
      noticeAfterNavigation({ title: 'État de sortie préparé', description: created.reference });
      push(bauxPaths.edl(created.id));
    } catch (error) {
      notify({ tone: 'danger', title: 'Préparation impossible', description: errorMessage(error) });
    }
  };

  return { sendForSignature, prepareExitState, signaturePending: requestSignature.isPending, preparePending: prepareExit.isPending };
}
