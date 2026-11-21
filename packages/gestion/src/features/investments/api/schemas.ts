import { z } from 'zod';
import { CURRENCIES } from '../../../format/money';
import { isoCurrency } from '../../orgapi/currency';
import { DEFERRAL_KINDS, FEE_KINDS, INSURANCE_MODES, LOAN_PURPOSES, LOAN_STATUSES, SCHEDULE_SOURCES } from '../model';

const id = z.guid();
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });
const rate = z.string().regex(/^\d+(\.\d+)?$/);

const fee = z.object({ id, kind: z.enum(FEE_KINDS), paid_on: isoDate, amount: money, stored_file_id: id.nullable() });
const attestation = z.object({ id, income_year: z.number().int(), interest: money, insurance: money, fees: money, stored_file_id: id.nullable() });

export const apiLoan = z.object({
  id,
  property_id: id,
  unit_id: id.nullable(),
  lender_label: z.string(),
  contract_reference: z.string().nullable(),
  purpose: z.enum(LOAN_PURPOSES),
  principal: money,
  nominal_rate: rate,
  first_due_on: isoDate,
  term_months: z.number().int().positive(),
  deferral_kind: z.enum(DEFERRAL_KINDS),
  deferral_months: z.number().int().nonnegative(),
  insurance_mode: z.enum(INSURANCE_MODES),
  insurance_rate: rate.nullable(),
  insurance_amount: money.nullable(),
  replaces_loan_id: id.nullable(),
  schedule_source: z.enum(SCHEDULE_SOURCES),
  status: z.enum(LOAN_STATUSES),
  void_reason: z.string().nullable(),
  repaid_on: isoDate.nullable(),
  stored_file_id: id.nullable(),
  outstanding: z.object({ as_of: isoDate, amount: money, basis: z.literal('schedule') }),
  lock_version: z.number().int().positive(),
  created_at: timestamp.nullable(),
  fees: z.array(fee).optional(),
  attestations: z.array(attestation).optional(),
});

export const apiLoanOne = z.object({ data: apiLoan });
export const apiLoanList = z.object({ data: z.array(apiLoan) });

export const apiFeeOne = z.object({ data: fee.extend({ loan_id: id }) });
export const apiAttestationOne = z.object({ data: attestation.extend({ loan_id: id }) });

const scheduleLine = z.object({
  position: z.number().int().positive(),
  due_on: isoDate,
  payment: money,
  interest: money,
  principal: money,
  insurance: money,
  total: money,
  outstanding_after: money,
});

export const apiSchedule = z.object({
  data: z.object({
    loan_id: id,
    source: z.enum(SCHEDULE_SOURCES),
    currency: z.enum(CURRENCIES),
    lines: z.array(scheduleLine),
    totals: z.object({ interest: money, insurance: money, principal: money }),
  }),
});

export const apiAcquisition = z.object({
  id,
  property_id: id,
  unit_id: id.nullable(),
  acquired_on: isoDate,
  price: money,
  acquisition_costs: money,
  agency_fees: money,
  initial_works: money,
  cost: money,
  stored_file_id: id.nullable(),
  lock_version: z.number().int().positive(),
  created_at: timestamp.nullable(),
  updated_at: timestamp.nullable(),
});

export const apiAcquisitionOne = z.object({ data: apiAcquisition });
export const apiAcquisitionList = z.object({ data: z.array(apiAcquisition) });

export const apiOrganizationCurrency = z.object({ data: z.object({ currency: isoCurrency }) });

export type ApiLoan = z.infer<typeof apiLoan>;
export type ApiSchedule = z.infer<typeof apiSchedule>['data'];
export type ApiAcquisition = z.infer<typeof apiAcquisition>;
