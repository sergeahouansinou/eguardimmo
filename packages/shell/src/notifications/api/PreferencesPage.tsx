'use client';

import type { LinkComponent } from '@eguardimmo/ui';
import { NotificationPreferencesPanel } from './PreferencesPanel';
import type { NotificationPreferencesPanelProps } from './PreferencesPanel';

export interface NotificationPreferencesPageProps extends NotificationPreferencesPanelProps {
  Link: LinkComponent;
  allHref: string;
}

export function NotificationPreferencesPage({ audience, Link, allHref }: NotificationPreferencesPageProps) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-page-title">Préférences de notification</h1>
        <p className="text-body text-fg-muted">
          Choisissez, pour chaque événement, si vous êtes prévenu dans l’application et par e-mail. Les e-mails partent vers l’adresse
          vérifiée de votre compte ; les notifications sur téléphone se règlent depuis l’application mobile.
        </p>
        <p className="text-body">
          <Link href={allHref} className="text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Voir toutes les notifications
          </Link>
        </p>
      </header>
      <NotificationPreferencesPanel audience={audience} />
    </>
  );
}
