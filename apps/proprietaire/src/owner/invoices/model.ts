import type { AgencyRef, Money } from "../shared/model";

export interface OwnerInvoice {
  id: string;
  kind: string;
  status: string;
  number: string | null;
  agency: AgencyRef;
  creditedInvoiceId: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  serviceFrom: string | null;
  serviceTo: string | null;
  currency: string;
  totalNet: Money;
  totalTax: Money;
  totalGross: Money;
  hasPdf: boolean;
}

export interface InvoiceLine {
  position: number;
  description: string;
  quantityMilli: number;
  unitPrice: Money;
  netAmount: Money;
  taxCategory: string;
  taxRatePcm: number;
}

export interface InvoiceTax {
  category: string;
  ratePcm: number;
  baseAmount: Money;
  taxAmount: Money;
}

export interface OwnerInvoiceDetail extends OwnerInvoice {
  lines: InvoiceLine[];
  taxes: InvoiceTax[];
}
