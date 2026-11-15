import { z } from "zod";

export const billingPeriodSchema = z.enum(["monthly", "yearly"]);
export type BillingPeriod = z.infer<typeof billingPeriodSchema>;

export const planSchema = z.object({
  id: z.enum(["agence", "agence-pro", "reseau"]),
  name: z.string(),
  monthlyMinor: z.number().int().nullable(),
  yearlyMinor: z.number().int().nullable(),
  lots: z.number().int().nullable(),
  seats: z.number().int().nullable(),
  features: z.array(z.string()),
  current: z.boolean(),
});
export type Plan = z.infer<typeof planSchema>;

export const paymentMethodSchema = z.object({
  id: z.string(),
  kind: z.enum(["card", "sepa"]),
  label: z.string(),
  addedAt: z.string(),
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const billingSchema = z.object({
  company: z.string(),
  address: z.string(),
  vatNumber: z.string(),
  email: z.string(),
});
export type Billing = z.infer<typeof billingSchema>;

export const billingInputSchema = z.object({
  company: z.string().trim().min(1, "La société est obligatoire."),
  address: z.string().trim().min(1, "L'adresse est obligatoire."),
  vatNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}[0-9A-Z]{8,12}$/, "Saisissez un numéro de TVA valide, par exemple FR40912345678.")),
  email: z.string().trim().pipe(z.email("Saisissez une adresse e-mail valide.")),
});
export type BillingInput = z.input<typeof billingInputSchema>;

export const subscriptionSchema = z.object({
  planId: z.enum(["agence", "agence-pro", "reseau"]),
  planName: z.string(),
  trial: z.object({
    startDate: z.string(),
    endDate: z.string(),
    daysLeft: z.number().int(),
    elapsedDays: z.number().int(),
    totalDays: z.number().int(),
  }),
  billingPeriod: billingPeriodSchema,
  firstCharge: z.object({ date: z.string(), amountMinor: z.number().int(), period: billingPeriodSchema }),
  plans: z.array(planSchema),
  paymentMethods: z.array(paymentMethodSchema),
  billing: billingSchema,
  usage: z.object({
    lots: z.object({ used: z.number().int(), limit: z.number().int() }),
    seats: z.object({ used: z.number().int(), limit: z.number().int() }),
    storage: z.object({ usedMb: z.number().int(), limitMb: z.number().int() }),
  }),
});
export type SubscriptionView = z.infer<typeof subscriptionSchema>;

export const changePlanInputSchema = z.object({
  planId: z.enum(["agence", "agence-pro"]),
  period: billingPeriodSchema,
});
export type ChangePlanInput = z.input<typeof changePlanInputSchema>;

export const addPaymentMethodInputSchema = z.object({ kind: z.enum(["card", "sepa"]) });
export type AddPaymentMethodInput = z.input<typeof addPaymentMethodInputSchema>;
