import { apiTaxIncome } from "@eguardimmo/gestion";
import { z } from "zod";
import { agencyRef, isoInstant, moneySchema, pageOf, singleOf } from "../shared/schemas";

const statement = z.object({
  id: z.uuid(),
  agency: agencyRef,
  income_year: z.number().int(),
  form_version: z.string(),
  status: z.enum(["published", "superseded"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  supersedes_id: z.uuid().nullable(),
  has_pdf: z.boolean(),
  published_at: isoInstant.nullable(),
});

export const statementListSchema = statement.extend({ totals: z.array(z.object({ code: z.string(), amount: moneySchema })) });
export const statementDetailSchema = statement.extend({ income: apiTaxIncome });

export const statementPageSchema = pageOf(statementListSchema);
export const statementResponseSchema = singleOf(statementDetailSchema);
