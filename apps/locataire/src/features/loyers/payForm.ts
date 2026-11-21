import { z } from 'zod';
import { ONLINE_METHODS } from '@/tenant/onlinePaymentSchemas';

export const payFormSchema = z.object({
  installmentIds: z.array(z.uuid()).min(1, 'Choisissez au moins une échéance à régler.'),
  method: z.enum(ONLINE_METHODS, 'Choisissez un moyen de paiement.'),
});

export type PayValues = z.input<typeof payFormSchema>;
