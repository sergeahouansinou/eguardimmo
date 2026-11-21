import type { ApiFeeMandate, ApiSimulationResponse } from './schemas';
import type { FeeMandateOption, FeeSimulation } from './model';

const ANONYMIZED_NAME = 'Mandant anonymisé';

export function toFeeMandate(api: ApiFeeMandate): FeeMandateOption {
  return {
    id: api.id,
    reference: api.reference,
    mandantName: api.mandant.is_anonymized ? ANONYMIZED_NAME : api.mandant.display_name,
    currency: api.currency,
    terms:
      api.terms === null
        ? null
        : {
            kind: api.terms.fee_kind,
            basisPoints: api.terms.fee_basis_points,
            flatAmount: api.terms.fee_flat_amount?.amount ?? null,
            base: api.terms.fee_base,
            minimumAmount: api.terms.fee_minimum_amount.amount,
            taxMode: api.terms.fee_tax_mode,
          },
  };
}

export function toSimulation(api: ApiSimulationResponse): FeeSimulation {
  const { meta } = api;
  return {
    mandateId: meta.mandate_id,
    monthsRequested: meta.months_requested,
    monthsReturned: meta.months_returned,
    currency: meta.currency,
    noClosedPeriod: meta.reason === 'no_closed_period',
    totals:
      meta.totals === null
        ? null
        : {
            simulatedNet: meta.totals.simulated_fee_net,
            simulatedTotal: meta.totals.simulated_fee_total,
            currentNet: meta.totals.current_fee_net,
            currentTotal: meta.totals.current_fee_total,
            differenceNet: meta.totals.difference_fee_net,
            differenceTotal: meta.totals.difference_fee_total,
          },
    months: api.data.map((line) => ({
      month: line.month,
      baseRent: line.base_rent,
      baseCharges: line.base_charges,
      current:
        line.current === null
          ? null
          : { source: line.current.source, feeNet: line.current.fee_net, taxAmount: line.current.tax_amount, feeTotal: line.current.fee_total, minimumApplied: line.current.minimum_applied },
      simulated: {
        source: line.simulated.source,
        feeNet: line.simulated.fee_net,
        taxAmount: line.simulated.tax_amount,
        feeTotal: line.simulated.fee_total,
        minimumApplied: line.simulated.minimum_applied,
      },
      difference: line.difference === null ? null : { feeNet: line.difference.fee_net, feeTotal: line.difference.fee_total },
    })),
  };
}
