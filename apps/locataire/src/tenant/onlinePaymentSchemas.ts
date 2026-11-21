import { z } from 'zod';
import { oneOf, timestamp } from './apiKit';
import { moneySchema } from './schemas';

export const ONLINE_STATUSES = ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired'] as const;
export type OnlineStatus = (typeof ONLINE_STATUSES)[number];
export const ONLINE_METHODS = ['card', 'direct_debit'] as const;
export type OnlineMethod = (typeof ONLINE_METHODS)[number];

export const optionsSchema = oneOf(
  z
    .object({
      available: z.boolean(),
      unavailable_reason: z.string().nullable(),
      methods: z.array(z.string()),
      installments: z.array(z.object({ id: z.uuid(), due_date: z.iso.date(), remaining: moneySchema })),
      total: moneySchema.nullable(),
    })
    .transform((item) => ({
      available: item.available,
      unavailableReason: item.unavailable_reason,
      methods: item.methods.filter((method): method is OnlineMethod => ONLINE_METHODS.some((known) => known === method)),
      installments: item.installments.map((installment) => ({ id: installment.id, dueOn: installment.due_date, remaining: installment.remaining })),
      total: item.total,
    })),
);
export type PaymentOptions = z.output<typeof optionsSchema>['data'];
export type PayableInstallment = PaymentOptions['installments'][number];

const payment = z
  .object({
    id: z.uuid(),
    lease_id: z.uuid(),
    status: z.enum(ONLINE_STATUSES),
    method: z.enum(ONLINE_METHODS),
    amount: moneySchema,
    installment_ids: z.array(z.uuid()),
    redirect_url: z.string().nullable(),
    failure_code: z.string().nullable(),
    created_at: timestamp,
    confirmed_at: timestamp.nullable(),
  })
  .transform((item) => ({
    id: item.id,
    leaseId: item.lease_id,
    status: item.status,
    method: item.method,
    amount: item.amount,
    installmentIds: item.installment_ids,
    redirectUrl: item.redirect_url,
    failureCode: item.failure_code,
    createdAt: item.created_at,
    confirmedAt: item.confirmed_at,
  }));

export type OnlinePayment = z.output<typeof payment>;
export const onlinePaymentSchema = oneOf(payment);

export const isLive = (status: OnlineStatus): boolean => status === 'pending' || status === 'processing';

const DEMO_PAYMENT_HOST = "pay.fake.invalid";

export function paymentHosts(): readonly string[] {
  const configured = (process.env.NEXT_PUBLIC_PAYMENT_REDIRECT_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== "");
  return process.env.NODE_ENV === "production" ? configured : [...configured, DEMO_PAYMENT_HOST];
}

export function safeRedirect(url: string | null, hosts: readonly string[] = paymentHosts()): string | null {
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    const allowed = parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" && hosts.includes(parsed.hostname);
    return allowed ? parsed.toString() : null;
  } catch {
    return null;
  }
}
