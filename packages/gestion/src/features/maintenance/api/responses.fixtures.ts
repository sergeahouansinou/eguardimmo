import detailApproved from './releves/org_detail_approved.json';
import detailAwaiting from './releves/org_detail_awaiting_approval.json';
import detailReported from './releves/org_detail_reported.json';
import detailReschedule from './releves/org_detail_reschedule.json';
import detailSettled from './releves/org_detail_settled.json';
import invoiceShow from './releves/org_invoice_show.json';
import list from './releves/org_list.json';
import parties from './releves/org_parties.json';
import supplierList from './releves/org_suppliers.json';
import termsNature from './releves/org_terms_nature.json';
import termsTaxRate from './releves/org_terms_tax_rate.json';
import units from './releves/org_units.json';

export const interventionsPage = list.body;
export const reportedDetail = detailReported.body;
export const advancedDetail = detailAwaiting.body;
export const approvedDetail = detailApproved.body;
export const rescheduleDetail = detailReschedule.body;
export const settledDetail = detailSettled.body;
export const advancedWithInvoiceDetail = { data: { ...advancedDetail.data, invoices: [invoiceShow.body.data] } };
export const suppliersPage = supplierList.body;
export const supplierShow = { data: suppliersPage.data[0] };
export const unitsPage = units.body;
export const partiesPage = parties.body;
export const natureTerms = termsNature.body;
export const taxRateTerms = termsTaxRate.body;

const supplier = suppliersPage.data[0];
const invoice = settledDetail.data.invoices[0];

export const IDS = {
  org: list.body.meta.path.split('/')[6] ?? '',
  intervention: reportedDetail.data.id,
  other: interventionsPage.data[0]?.id ?? '',
  unit: reportedDetail.data.unit_id,
  nature: reportedDetail.data.nature_term_id,
  electrical: natureTerms.data[1]?.id ?? '',
  mandant: advancedDetail.data.mandant.id,
  reporter: reportedDetail.data.reporter.id,
  supplierParty: supplier?.party.id ?? '',
  supplier: supplier?.id ?? '',
  visit: settledDetail.data.visits[0]?.id ?? '',
  quote: advancedDetail.data.quotes[0]?.id ?? '',
  approval: advancedDetail.data.approvals[0]?.id ?? '',
  invoice: invoice?.id ?? '',
  allocation: invoice?.allocations[0]?.id ?? '',
  payment: invoice?.payments[0]?.id ?? '',
  file: reportedDetail.data.files[0]?.id ?? '',
  proof: approvedDetail.data.approvals[0]?.proof_file_id ?? '',
  event: reportedDetail.data.events[0]?.id ?? '',
  rate: taxRateTerms.data[0]?.id ?? '',
};

const lot = unitsPage.data[0];

export const LABELS = {
  title: reportedDetail.data.title,
  property: lot?.property.name ?? '',
  lot: lot?.reference ?? '',
  lotChoice: `${lot?.reference ?? ''} · ${lot?.property.name ?? ''}`,
  supplier: supplier?.party.name ?? '',
  mandant: advancedDetail.data.mandant.name,
  reporter: reportedDetail.data.reporter.name,
  invoiceNumber: invoiceShow.body.data.number,
  quoteReference: advancedDetail.data.quotes[0]?.reference ?? '',
};

export const ack = (id: string, extra: Record<string, unknown> = {}) => ({ data: { id, ...extra } });

export const problemBody = (status: number, code: string, detail: string, errors?: Record<string, string[]>) => ({
  type: 'about:blank',
  title: detail,
  status,
  code,
  detail,
  ...(errors ? { errors } : {}),
});
