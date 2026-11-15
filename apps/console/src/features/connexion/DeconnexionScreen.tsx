'use client';

import { Alert, Button, Spinner } from '@eguardimmo/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useConsoleSource } from '@/console/source';

export function DeconnexionScreen() {
  const router = useRouter();
  const source = useConsoleSource();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    source.auth.signOut().then(
      () => {
        if (active) router.replace('/connexion');
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [source, router, attempt]);

  if (failed) {
    return (
      <main id="contenu" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-4">
        <Alert tone="danger" title="La déconnexion a échoué">
          Votre session n’a pas pu être fermée. Réessayez avant de quitter cet appareil.
        </Alert>
        <Button
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          Réessayer
        </Button>
      </main>
    );
  }

  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center gap-2 text-body text-fg-muted">
      <Spinner size={20} label="Déconnexion en cours" />
      Déconnexion en cours…
    </main>
  );
}
