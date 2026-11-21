'use client';

import { useReceiptPdf } from './hooks';
import { safeFilename, saveBlob } from './download';
import type { RentReceipt } from './model';
import { errorMessage, useNotify } from '../../locataires/kit';

export function useReceiptDownload() {
  const pdf = useReceiptPdf();
  const notify = useNotify();
  return async (receipt: Pick<RentReceipt, 'id' | 'number'>) => {
    try {
      saveBlob(await pdf.mutateAsync(receipt.id), safeFilename(`Quittance-${receipt.number}`));
    } catch (error) {
      notify({ tone: 'danger', title: 'Téléchargement impossible', description: errorMessage(error) });
    }
  };
}
