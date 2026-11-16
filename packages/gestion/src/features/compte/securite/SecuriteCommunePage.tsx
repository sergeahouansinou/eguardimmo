'use client';

import { authUrl } from '@eguardimmo/shell';
import { Alert, Button, Icon } from '@eguardimmo/ui';
import { ExternalLink } from 'lucide-react';

export function SecuriteCommunePage() {
  return (
    <>
      <h1 className="text-page-title">Connexion et sécurité</h1>
      <Alert tone="info" title="La sécurité se gère dans Mon compte">
        Mot de passe, double authentification et appareils connectés sont communs à tous vos espaces eGuardImmo.
      </Alert>
      <div>
        <Button asChild>
          <a href={authUrl('/compte/securite')} target="_blank" rel="noopener noreferrer">
            Gérer dans Mon compte
            <Icon icon={ExternalLink} />
            <span className="sr-only">, s&apos;ouvre dans un nouvel onglet</span>
          </a>
        </Button>
      </div>
    </>
  );
}
