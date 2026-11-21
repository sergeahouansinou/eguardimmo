import { ApiError } from '@eguardimmo/api';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { PlanLimitAlert } from './PlanLimitAlert';
import { isPlanFeatureError, isPlanLimitError, planLimitMessage } from './planLimit';

const quota = (extensions: Record<string, unknown>) => new ApiError(409, 'plan_quota_reached', 'Quota atteint côté serveur.', {}, null, extensions);
const notInPlan = (extensions: Record<string, unknown>) => new ApiError(403, 'feature_not_in_plan', 'Fonction absente côté serveur.', {}, null, extensions);

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

describe('planLimitMessage', () => {
  it('annonce le quota atteint avec le décompte et la limite', () => {
    expect(planLimitMessage(quota({ feature: 'properties', limit: 20, current: 20 }))).toBe('Limite de votre plan atteinte : 20 lots sur 20. Passez à une formule supérieure pour continuer.');
    expect(planLimitMessage(quota({ feature: 'leases', limit: 1, current: 1 }))).toBe('Limite de votre plan atteinte : 1 bail sur 1. Passez à une formule supérieure pour continuer.');
    expect(planLimitMessage(quota({ feature: 'users', limit: 3, current: 3 }))).toContain('3 membres sur 3');
    expect(planLimitMessage(quota({ feature: 'users', limit: 10, current: 7 }))).toContain('7 membres sur 10');
    expect(planLimitMessage(quota({ feature: 'inspections', limit: 5, current: 5 }))).toContain('5 états des lieux sur 5');
  });

  it('reste clair quand le décompte ou la fonction est inconnu', () => {
    expect(planLimitMessage(quota({ feature: 'properties' }))).toBe('Limite de votre plan atteinte. Passez à une formule supérieure pour continuer.');
    expect(planLimitMessage(quota({ feature: 'autre', limit: 4, current: 4 }))).toBe('Limite de votre plan atteinte : 4 sur 4. Passez à une formule supérieure pour continuer.');
  });

  it('explique qu’une fonction n’est pas incluse dans le plan', () => {
    expect(planLimitMessage(notInPlan({ feature: 'leases' }))).toBe('Cette fonction (baux) n’est pas incluse dans votre plan. Passez à une formule supérieure pour continuer.');
  });

  it('ignore les autres codes', () => {
    expect(planLimitMessage(new ApiError(409, 'lease_stale_version', 'Conflit', {}, null, {}))).toBeNull();
  });

  it('reconnaît les erreurs de plan par leur code', () => {
    expect(isPlanLimitError(quota({}))).toBe(true);
    expect(isPlanLimitError(notInPlan({}))).toBe(true);
    expect(isPlanFeatureError(notInPlan({}))).toBe(true);
    expect(isPlanFeatureError(quota({}))).toBe(false);
    expect(isPlanLimitError(new Error('autre'))).toBe(false);
    expect(isPlanLimitError(null)).toBe(false);
  });
});

describe('PlanLimitAlert', () => {
  it('affiche le message et le lien vers l’abonnement', () => {
    const error = Object.assign(new Error(planLimitMessage(quota({ feature: 'properties', limit: 20, current: 20 })) ?? ''), { code: 'plan_quota_reached' });
    render(<PlanLimitAlert error={error} Link={TestLink} />);
    expect(screen.getByText('Limite de votre plan atteinte')).toBeTruthy();
    expect(screen.getByText(/20 lots sur 20/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir mon abonnement' }).getAttribute('href')).toBe('/compte/abonnement');
  });

  it('formule le message depuis une ApiError brute, sans reprendre le texte du serveur', () => {
    render(<PlanLimitAlert error={quota({ feature: 'users', limit: 3, current: 3 })} Link={TestLink} />);
    expect(screen.getByText(/Limite de votre plan atteinte : 3 membres sur 3\./)).toBeTruthy();
    expect(screen.queryByText(/Quota atteint côté serveur/)).toBeNull();
  });

  it('titre la fonction absente du plan', () => {
    render(<PlanLimitAlert error={notInPlan({ feature: 'leases' })} Link={TestLink} />);
    expect(screen.getByText('Fonction absente de votre plan')).toBeTruthy();
  });

  it('n’affiche rien pour une autre erreur ou aucune erreur', () => {
    const { container, rerender } = render(<PlanLimitAlert error={new Error('Autre')} Link={TestLink} />);
    expect(container.textContent).toBe('');
    rerender(<PlanLimitAlert error={null} Link={TestLink} />);
    expect(container.textContent).toBe('');
  });
});
