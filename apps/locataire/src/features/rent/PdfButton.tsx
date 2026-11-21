'use client';

import { Button, Icon, IconButton } from '@eguardimmo/ui';
import { FileDown } from 'lucide-react';
import { FailureAlert } from '@/components/FailureAlert';
import { pdfFilename } from '@/tenant/download';
import { noticePdfPath, receiptPdfPath } from '@/tenant/rentRequests';
import { usePdfDownload } from '@/tenant/rentQueries';
import type { Installment, Receipt } from '@/tenant/rentModel';

export type Downloads = ReturnType<typeof usePdfDownload>;

export function noticeRequest(installment: Pick<Installment, 'id'> & { notice: NonNullable<Installment['notice']> }) {
  return { path: noticePdfPath(installment.id), filename: pdfFilename(`Avis-echeance-${installment.notice.number}`) };
}

export function receiptRequest(receipt: Pick<Receipt, 'id' | 'number'>) {
  return { path: receiptPdfPath(receipt.id), filename: pdfFilename(`Quittance-${receipt.number}`) };
}

export function PdfIconButton({ label, downloads, request }: { label: string; downloads: Downloads; request: { path: string; filename: string } }) {
  return <IconButton label={label} icon={FileDown} variant="secondary" disabled={downloads.isPending} onClick={() => { downloads.mutate(request); }} />;
}

export function PdfTextButton({ children, downloads, request }: { children: string; downloads: Downloads; request: { path: string; filename: string } }) {
  return (
    <Button variant="secondary" loading={downloads.isPending} onClick={() => { downloads.mutate(request); }}>
      <Icon icon={FileDown} />
      {children}
    </Button>
  );
}

export function DownloadFailure({ downloads }: { downloads: Downloads }) {
  if (!downloads.isError) return null;
  return <FailureAlert title="Le téléchargement a échoué" error={downloads.error} wording={{ notFound: 'Ce document n’est plus disponible.' }} />;
}
