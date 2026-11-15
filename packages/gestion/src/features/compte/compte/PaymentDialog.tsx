'use client';

import { ExternalLink } from 'lucide-react';
import { Button, Dialog, DialogClose, DialogContent, Icon } from '@eguardimmo/ui';
import type { Subscription } from './schemas';

export const PAYMENT_PORTAL_URL = 'https://paiement.example.com/portail';

export function PaymentDialog({ open, onOpenChange, method }: { open: boolean; onOpenChange: (open: boolean) => void; method: Subscription['paymentMethod'] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Moyen de paiement"
        description="Pour votre sécurité, les données de carte ne sont jamais saisies dans eGuardImmo : elles se mettent à jour chez notre prestataire de paiement."
        className="max-w-md"
      >
        <div className="flex flex-col gap-3 p-4">
          <p className="text-body text-fg">
            <b className="font-semibold">{method.brand} se terminant par {method.last4}</b>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Fermer</Button>
            </DialogClose>
            <Button asChild className="h-auto! min-h-8 max-w-full py-1.5 text-center whitespace-normal!">
              <a href={PAYMENT_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                <Icon icon={ExternalLink} />
                Ouvrir l'espace sécurisé du prestataire
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
