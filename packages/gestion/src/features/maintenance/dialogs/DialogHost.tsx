'use client';

import type { Approval, InterventionDetail, SupplierInvoice } from '../model';
import { DocumentDialogsHost } from './DocumentHost';
import { AssignDialog, CancelDialog, CloseDialog, CompleteDialog, DeclineDialog, EngageDialog, QualifyDialog, ReopenDialog } from './LifecycleDialogs';
import { FileDialog, VisitDialog } from './VisitFileDialogs';

export type DialogRequest =
  | { name: 'qualify' | 'decline' | 'cancel' | 'assign' | 'engage' | 'complete' | 'close' | 'reopen' | 'visit' | 'file' | 'quote' | 'invoice' }
  | { name: 'decision'; approval: Approval }
  | { name: 'allocate' | 'pay'; invoice: SupplierInvoice };

export function DialogHost({ request, intervention, onClose }: { request: DialogRequest | null; intervention: InterventionDetail; onClose: () => void }) {
  if (request === null) return null;
  const currency = intervention.currency;
  const shared = { intervention, onClose };
  switch (request.name) {
    case 'qualify': return <QualifyDialog {...shared} currency={currency} />;
    case 'decline': return <DeclineDialog {...shared} />;
    case 'cancel': return <CancelDialog {...shared} />;
    case 'assign': return <AssignDialog {...shared} />;
    case 'engage': return <EngageDialog {...shared} />;
    case 'complete': return <CompleteDialog {...shared} />;
    case 'close': return <CloseDialog {...shared} />;
    case 'reopen': return <ReopenDialog {...shared} />;
    case 'visit': return <VisitDialog {...shared} />;
    case 'file': return <FileDialog {...shared} />;
    default: return <DocumentDialogsHost request={request} {...shared} currency={currency} />;
  }
}
