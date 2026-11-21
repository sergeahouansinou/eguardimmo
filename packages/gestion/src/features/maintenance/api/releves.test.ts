import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import allocationCreated from './releves/org_allocation_created.json';
import approvalRecorded from './releves/org_approval_recorded.json';
import commentCreated from './releves/org_comment_created.json';
import declined from './releves/org_declined.json';
import detailApproved from './releves/org_detail_approved.json';
import detailAwaiting from './releves/org_detail_awaiting_approval.json';
import detailReported from './releves/org_detail_reported.json';
import detailReschedule from './releves/org_detail_reschedule.json';
import detailSettled from './releves/org_detail_settled.json';
import fileUploaded from './releves/org_file_uploaded.json';
import invoiceCreated from './releves/org_invoice_created.json';
import invoiceSettled from './releves/org_invoice_show_settled.json';
import list from './releves/org_list.json';
import listPage1 from './releves/org_list_page1.json';
import parties from './releves/org_parties.json';
import paymentCreated from './releves/org_payment_created.json';
import quoteCreated from './releves/org_quote_created.json';
import supplierCreated from './releves/org_supplier_created.json';
import suppliers from './releves/org_suppliers.json';
import termsNature from './releves/org_terms_nature.json';
import termsTaxRate from './releves/org_terms_tax_rate.json';
import units from './releves/org_units.json';
import visitCreated from './releves/org_visit_created.json';
import {
  apiAck,
  apiFileResponse,
  apiInterventionPage,
  apiInterventionResponse,
  apiPartyPage,
  apiReplayable,
  apiSupplierPage,
  apiSupplierResponse,
  apiTerms,
  apiUnitPage,
} from './maintenanceSchemas';

interface Releve {
  status: number;
  body: unknown;
}

const conforme = (schema: z.ZodType, releve: Releve) => {
  const result = schema.safeParse(releve.body);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')} : ${issue.message}`);
};

describe('réponses relevées sur le serveur (Pest, base éphémère)', () => {
  it.each([
    ['liste', apiInterventionPage, list],
    ['liste paginée', apiInterventionPage, listPage1],
    ['fiche signalée', apiInterventionResponse, detailReported],
    ['fiche en attente d’accord', apiInterventionResponse, detailAwaiting],
    ['fiche accord enregistré', apiInterventionResponse, detailApproved],
    ['fiche report demandé', apiInterventionResponse, detailReschedule],
    ['fiche facturée et imputée', apiInterventionResponse, detailSettled],
    ['classement sans suite', apiInterventionResponse, declined],
    ['prestataires', apiSupplierPage, suppliers],
    ['prestataire créé', apiSupplierResponse, supplierCreated],
    ['lots', apiUnitPage, units],
    ['parties', apiPartyPage, parties],
    ['natures', apiTerms, termsNature],
    ['taux de TVA', apiTerms, termsTaxRate],
    ['fichier envoyé', apiFileResponse, fileUploaded],
    ['accord enregistré', apiReplayable, approvalRecorded],
    ['facture enregistrée', apiReplayable, invoiceCreated],
    ['facture réglée', apiReplayable, invoiceSettled],
    ['imputation', apiReplayable, allocationCreated],
    ['règlement', apiReplayable, paymentCreated],
    ['devis saisi', apiAck, quoteCreated],
    ['visite créée', apiAck, visitCreated],
    ['commentaire', apiAck, commentCreated],
  ] as const)('%s est lue sans écart par le schéma', (_, schema, releve) => {
    expect(releve.status).toBeLessThan(300);
    expect(conforme(schema, releve)).toEqual([]);
  });
});
