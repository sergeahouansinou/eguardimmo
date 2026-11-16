import type { CourriersSource } from '../sourceTypes';

export const COURRIERS_UNAVAILABLE_MESSAGE = 'Les courriers, quittances, avis et signatures ne sont pas encore reliés au serveur.';

const refuse = (): Promise<never> => Promise.reject(new Error(COURRIERS_UNAVAILABLE_MESSAGE));

export function createUnavailableCourriersSource(): CourriersSource {
  return {
    unavailableInApiMode: true,
    templates: refuse,
    createTemplate: refuse,
    updateTemplate: refuse,
    duplicateTemplate: refuse,
    restoreTemplate: refuse,
    setTemplateArchived: refuse,
    deleteTemplate: refuse,
    courriers: refuse,
    createCourrier: refuse,
    markCourrierSent: refuse,
    resendCourrier: refuse,
    setCourrierArchived: refuse,
    deleteCourrier: refuse,
    updateCourrier: refuse,
    signatures: refuse,
    createSignature: refuse,
    cancelSignature: refuse,
    remindSignature: refuse,
    receipts: refuse,
    emitReceipts: refuse,
    markReceiptSent: refuse,
    cancelReceipt: refuse,
    notices: refuse,
    sendNotice: refuse,
  };
}
