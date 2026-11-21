'use client';

import type { Currency } from '../model';
import type { DialogProps } from './common';
import type { DialogRequest } from './DialogHost';
import { DecisionDialog, QuoteDialog, SupplierInvoiceDialog } from './DocumentDialogs';
import { AllocationDialog, SupplierPaymentDialog } from './SettlementDialogs';

export function DocumentDialogsHost({ request, currency, ...shared }: DialogProps & { request: DialogRequest; currency: Currency }) {
  switch (request.name) {
    case 'quote': return <QuoteDialog {...shared} currency={currency} />;
    case 'invoice': return <SupplierInvoiceDialog {...shared} currency={currency} />;
    case 'decision': return <DecisionDialog {...shared} approval={request.approval} />;
    case 'allocate': return <AllocationDialog {...shared} invoice={request.invoice} />;
    case 'pay': return <SupplierPaymentDialog {...shared} invoice={request.invoice} />;
    default: return null;
  }
}
