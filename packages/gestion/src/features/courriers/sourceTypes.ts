import type { CourrierStatus } from './schemas';

export type TemplateMode = 'actif' | 'brouillon';

export interface CourriersSource {
  templates: () => Promise<unknown>;
  createTemplate: (input: unknown, mode?: TemplateMode) => Promise<unknown>;
  updateTemplate: (id: string, input: unknown, mode?: TemplateMode) => Promise<unknown>;
  duplicateTemplate: (id: string) => Promise<unknown>;
  restoreTemplate: (id: string) => Promise<unknown>;
  setTemplateArchived: (id: string, archived: boolean) => Promise<unknown>;
  deleteTemplate: (id: string) => Promise<void>;
  courriers: () => Promise<unknown>;
  createCourrier: (input: unknown, status: Exclude<CourrierStatus, 'envoye'>) => Promise<unknown>;
  markCourrierSent: (id: string) => Promise<unknown>;
  resendCourrier: (id: string) => Promise<unknown>;
  setCourrierArchived: (id: string, archived: boolean) => Promise<unknown>;
  deleteCourrier: (id: string) => Promise<void>;
  signatures: () => Promise<unknown>;
  createSignature: (input: unknown) => Promise<unknown>;
  cancelSignature: (id: string) => Promise<unknown>;
  remindSignature: (id: string) => Promise<unknown>;
  updateCourrier: (id: string, input: unknown) => Promise<unknown>;
  receipts: () => Promise<unknown>;
  emitReceipts: (month: string) => Promise<unknown>;
  markReceiptSent: (id: string) => Promise<unknown>;
  cancelReceipt: (id: string, input: unknown) => Promise<unknown>;
  notices: () => Promise<unknown>;
  sendNotice: (id: string) => Promise<unknown>;
}
