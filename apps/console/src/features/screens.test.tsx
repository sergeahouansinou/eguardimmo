import { screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { renderWithConsole } from '../../test/render';
import { AbonnementsScreen } from './abonnements/AbonnementsScreen';
import { PlanFormScreen } from './abonnements/PlanFormScreen';
import { AuditDetailScreen } from './audit/AuditDetailScreen';
import { AuditScreen } from './audit/AuditScreen';
import { CompteDetailScreen } from './comptes/CompteDetailScreen';
import { ComptesScreen } from './comptes/ComptesScreen';
import { EquipeScreen } from './equipe/EquipeScreen';
import { InviteScreen } from './equipe/InviteScreen';
import { ModuleDetailScreen } from './modules/ModuleDetailScreen';
import { ModulesScreen } from './modules/ModulesScreen';
import { OrganisationDetailScreen } from './organisations/OrganisationDetailScreen';
import { OrganisationFormScreen } from './organisations/OrganisationFormScreen';
import { OrganisationModulesScreen } from './organisations/OrganisationModulesScreen';
import { OrganisationsScreen } from './organisations/OrganisationsScreen';
import { OverviewScreen } from './overview/OverviewScreen';
import { GeneralScreen } from './parametres/GeneralScreen';
import { InformationsScreen } from './parametres/InformationsScreen';
import { NotificationsScreen } from './parametres/NotificationsScreen';
import { SecurityScreen } from './parametres/SecurityScreen';
import { RgpdDetailScreen } from './rgpd/RgpdDetailScreen';
import { RgpdScreen } from './rgpd/RgpdScreen';
import { IncidentScreen } from './sante/IncidentScreen';
import { SanteScreen } from './sante/SanteScreen';
import { RestaurationScreen } from './sauvegardes/RestaurationScreen';
import { SauvegardesScreen } from './sauvegardes/SauvegardesScreen';

const SCREENS: readonly [string, () => ReactElement][] = [
  ['vue d’ensemble', () => <OverviewScreen />],
  ['organisations', () => <OrganisationsScreen />],
  ['organisation, détail', () => <OrganisationDetailScreen id="cabinet-delmas-immobilier" />],
  ['organisation, modules', () => <OrganisationModulesScreen id="cabinet-delmas-immobilier" />],
  ['organisation, création', () => <OrganisationFormScreen />],
  ['comptes', () => <ComptesScreen />],
  ['compte, détail', () => <CompteDetailScreen id="marc-chevalier" />],
  ['modules', () => <ModulesScreen />],
  ['module, détail', () => <ModuleDetailScreen id="messagerie" />],
  ['abonnements', () => <AbonnementsScreen />],
  ['plan, création', () => <PlanFormScreen />],
  ['plan, édition', () => <PlanFormScreen planId="silver" />],
  ['journal d’audit', () => <AuditScreen />],
  ['événement d’audit', () => <AuditDetailScreen id="evt-2026-204518" />],
  ['RGPD', () => <RgpdScreen />],
  ['demande RGPD', () => <RgpdDetailScreen id="paul-lemoine-effacement" />],
  ['santé', () => <SanteScreen />],
  ['incident', () => <IncidentScreen id="inc-2026-031" />],
  ['sauvegardes', () => <SauvegardesScreen />],
  ['restauration', () => <RestaurationScreen />],
  ['paramètres généraux', () => <GeneralScreen />],
  ['paramètres de sécurité', () => <SecurityScreen />],
  ['notifications', () => <NotificationsScreen />],
  ['informations de l’opérateur', () => <InformationsScreen />],
  ['équipe', () => <EquipeScreen />],
  ['invitation', () => <InviteScreen />],
];

describe('écrans de la console', () => {
  it.each(SCREENS)('%s : s’affiche avec des données et sans violation d’accessibilité', async (_name, build) => {
    const { container } = renderWithConsole(build());
    await waitFor(() => { expect(screen.queryByRole('status', { name: /chargement/i })).toBeNull(); }, { timeout: 4000 });
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    expect(screen.queryByText(/introuvable/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /réessayer/i })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('organisation inconnue : état introuvable avec retour', async () => {
    renderWithConsole(<OrganisationDetailScreen id="n-existe-pas" />);
    expect(await screen.findByRole('heading', { name: /introuvable/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /retour/i })).toBeTruthy();
  });
});
