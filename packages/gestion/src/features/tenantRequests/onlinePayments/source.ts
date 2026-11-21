'use client';

import type { ConfirmProof } from '../../reauth/proof';
import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { Page } from '../shared/model';
import type { OnlinePayment, PaymentAccount, PaymentQuery } from './model';

export interface OnlinePaymentsSource {
  list: (query: PaymentQuery) => Promise<Page<OnlinePayment>>;
  account: () => Promise<PaymentAccount | null>;
  onboard: () => Promise<PaymentAccount>;
  confirmTwoFactor: ConfirmProof;
}

const context = createSourceContext<OnlinePaymentsSource>('Paiements en ligne', () => {
  throw new MissingSourceError('Paiements en ligne');
});

export const OnlinePaymentsSourceProvider = context.SourceProvider;
export const useOnlinePaymentsSource = context.useSource;
