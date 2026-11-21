import { z } from 'zod';
import { PAYMENT_STATUSES } from './model';

export const paymentFilterSchema = z.enum(PAYMENT_STATUSES).nullable();
