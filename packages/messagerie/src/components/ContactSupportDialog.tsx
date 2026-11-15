'use client';

import { LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, DialogTrigger, Icon } from '@eguardimmo/ui';
import { ContactSupportForm } from './ContactSupportForm';

export function ContactSupportDialog() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCreated(false);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Icon icon={LifeBuoy} />
          Écrire au support
        </Button>
      </DialogTrigger>
      <DialogContent title="Contacter le support" description="Décrivez votre demande, le support vous répond dans les meilleurs délais.">
        <div className="max-h-[70vh] overflow-y-auto px-4 pt-3 pb-4">
          {created ? (
            <div className="flex flex-col gap-3">
              <Alert tone="success" title="Demande envoyée">
                Votre demande est enregistrée. Suivez-la depuis la bulle d’aide, rubrique « Mes demandes ».
              </Alert>
              <div className="flex justify-end">
                <DialogClose asChild>
                  <Button variant="secondary">Fermer</Button>
                </DialogClose>
              </div>
            </div>
          ) : (
            <ContactSupportForm
              onCreated={() => { setCreated(true); }}
              onCancel={() => { setOpen(false); }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
