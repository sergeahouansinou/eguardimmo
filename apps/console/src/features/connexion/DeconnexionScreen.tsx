'use client';

import { Spinner } from '@eguardimmo/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useConsoleSource } from '@/console/source';

export function DeconnexionScreen() {
  const router = useRouter();
  const source = useConsoleSource();
  useEffect(() => {
    let active = true;
    void source.auth.signOut().finally(() => {
      if (active) router.replace('/connexion');
    });
    return () => {
      active = false;
    };
  }, [source, router]);
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center gap-2 text-body text-fg-muted">
      <Spinner size={20} label="Déconnexion en cours" />
      Déconnexion en cours…
    </main>
  );
}
