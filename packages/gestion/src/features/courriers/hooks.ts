'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useClientQuery } from '../locataires/kit/query';
import { courrierSchema, noticeSchema, receiptSchema, signatureSchema, templateSchema } from './schemas';
import type { CourrierInput, CourrierStatus, ReceiptCancelInput, SignatureInput, TemplateInput } from './schemas';
import { useCourriersSource } from './source';
import type { TemplateMode } from './source';

export const courriersKeys = {
  all: ['gestion', 'courriers'] as const,
  templates: ['gestion', 'courriers', 'templates'] as const,
  courriers: ['gestion', 'courriers', 'courriers'] as const,
  signatures: ['gestion', 'courriers', 'signatures'] as const,
  receipts: ['gestion', 'courriers', 'receipts'] as const,
  notices: ['gestion', 'courriers', 'notices'] as const,
};

export function useTemplates() {
  const source = useCourriersSource();
  return useClientQuery(courriersKeys.templates, () => source.templates(), z.array(templateSchema));
}

export function useCourriers() {
  const source = useCourriersSource();
  return useClientQuery(courriersKeys.courriers, () => source.courriers(), z.array(courrierSchema));
}

export function useSignatures() {
  const source = useCourriersSource();
  return useClientQuery(courriersKeys.signatures, () => source.signatures(), z.array(signatureSchema));
}

export function useReceipts() {
  const source = useCourriersSource();
  return useClientQuery(courriersKeys.receipts, () => source.receipts(), z.array(receiptSchema));
}

export function useNotices() {
  const source = useCourriersSource();
  return useClientQuery(courriersKeys.notices, () => source.notices(), z.array(noticeSchema));
}

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: courriersKeys.all });
}

export function useCreateTemplate() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ input, mode = 'actif' }: { input: TemplateInput; mode?: TemplateMode }) => templateSchema.parse(await source.createTemplate(input, mode)),
    onSuccess: invalidate,
  });
}

export function useUpdateTemplate(id: string) {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ input, mode = 'actif' }: { input: TemplateInput; mode?: TemplateMode }) => templateSchema.parse(await source.updateTemplate(id, input, mode)),
    onSuccess: invalidate,
  });
}

export function useRestoreTemplate() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => templateSchema.parse(await source.restoreTemplate(id)), onSuccess: invalidate });
}

export function useDuplicateTemplate() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => templateSchema.parse(await source.duplicateTemplate(id)), onSuccess: invalidate });
}

export function useArchiveTemplate() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => templateSchema.parse(await source.setTemplateArchived(id, archived)),
    onSuccess: invalidate,
  });
}

export function useDeleteTemplate() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => source.deleteTemplate(id), onSuccess: invalidate });
}

export function useCreateCourrier() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ input, status }: { input: CourrierInput; status: Exclude<CourrierStatus, 'envoye'> }) =>
      courrierSchema.parse(await source.createCourrier(input, status)),
    onSuccess: invalidate,
  });
}

export function useMarkCourrierSent() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => courrierSchema.parse(await source.markCourrierSent(id)), onSuccess: invalidate });
}

export function useResendCourrier() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => courrierSchema.parse(await source.resendCourrier(id)), onSuccess: invalidate });
}

export function useArchiveCourrier() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => courrierSchema.parse(await source.setCourrierArchived(id, archived)),
    onSuccess: invalidate,
  });
}

export function useDeleteCourrier() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => source.deleteCourrier(id), onSuccess: invalidate });
}

export function useCreateSignature() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (input: SignatureInput) => signatureSchema.parse(await source.createSignature(input)), onSuccess: invalidate });
}

export function useRemindSignature() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => signatureSchema.parse(await source.remindSignature(id)), onSuccess: invalidate });
}

export function useUpdateCourrier(id: string) {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (input: CourrierInput) => courrierSchema.parse(await source.updateCourrier(id, input)), onSuccess: invalidate });
}

export function useCancelSignature() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => signatureSchema.parse(await source.cancelSignature(id)), onSuccess: invalidate });
}

export function useEmitReceipts() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (month: string) => z.array(receiptSchema).parse(await source.emitReceipts(month)), onSuccess: invalidate });
}

export function useMarkReceiptSent() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => receiptSchema.parse(await source.markReceiptSent(id)), onSuccess: invalidate });
}

export function useCancelReceipt() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ReceiptCancelInput }) => receiptSchema.parse(await source.cancelReceipt(id, input)),
    onSuccess: invalidate,
  });
}

export function useSendNotice() {
  const source = useCourriersSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => noticeSchema.parse(await source.sendNotice(id)), onSuccess: invalidate });
}
