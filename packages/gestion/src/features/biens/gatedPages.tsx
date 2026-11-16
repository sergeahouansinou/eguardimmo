'use client';

import type { ComponentType } from 'react';
import { FeatureUnavailable, useFeatureUnavailable } from './FeatureGate';
import type { BiensFeature } from './capabilities';
import { PageHeader } from './components/PageHeader';
import { biensPaths } from './paths';
import { EquipementDocuments as EquipementDocumentsTab } from './screens/equipements/EquipementDocuments';
import { EquipementEntretien as EquipementEntretienTab } from './screens/equipements/EquipementEntretien';
import { EquipementFiche as EquipementFicheShell } from './screens/equipements/EquipementFiche';
import { EquipementForm as EquipementFormPage } from './screens/equipements/EquipementForm';
import { EquipementInterventions as EquipementInterventionsTab } from './screens/equipements/EquipementInterventions';
import { EquipementOverview as EquipementOverviewTab } from './screens/equipements/EquipementOverview';
import { EquipementsScreen as EquipementsPage } from './screens/equipements/EquipementsScreen';
import { ImmeubleCharges as ImmeubleChargesTab } from './screens/immeubles/ImmeubleCharges';
import { ImmeubleCopro as ImmeubleCoproTab } from './screens/immeubles/ImmeubleCopro';
import { ImmeubleDocuments as ImmeubleDocumentsTab } from './screens/immeubles/ImmeubleDocuments';
import { ImmeubleEquipements as ImmeubleEquipementsTab } from './screens/immeubles/ImmeubleEquipements';
import { ImmeubleInterventions as ImmeubleInterventionsTab } from './screens/immeubles/ImmeubleInterventions';
import { InventairesScreen as InventairesPage } from './screens/inventaires/InventairesScreen';
import { LotCompteurs as LotCompteursTab } from './screens/lots/LotCompteurs';
import { LotDiagnostics as LotDiagnosticsTab } from './screens/lots/LotDiagnostics';
import { LotDocuments as LotDocumentsTab } from './screens/lots/LotDocuments';
import { LotEquipements as LotEquipementsTab } from './screens/lots/LotEquipements';
import { LotFinances as LotFinancesTab } from './screens/lots/LotFinances';
import { RelevesScreen as RelevesPage } from './screens/releves/RelevesScreen';

function gatedTab<P extends object>(feature: BiensFeature, title: string, Tab: ComponentType<P>): ComponentType<P> {
  function GatedTab(props: P) {
    return useFeatureUnavailable(feature) ? <FeatureUnavailable feature={feature} /> : <Tab {...props} />;
  }
  GatedTab.displayName = `Gated(${title})`;
  return GatedTab;
}

function gatedPage<P extends object>(feature: BiensFeature, title: string, parent: { label: string; href: string }, Page: ComponentType<P>): ComponentType<P> {
  function GatedPage(props: P) {
    if (!useFeatureUnavailable(feature)) return <Page {...props} />;
    return (
      <>
        <PageHeader crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Biens', href: biensPaths.lots }, { label: parent.label, href: parent.href }, { label: title }]} title={title} />
        <FeatureUnavailable feature={feature} />
      </>
    );
  }
  GatedPage.displayName = `Gated(${title})`;
  return GatedPage;
}

const equipements = { label: 'Équipements', href: biensPaths.equipements };

export const LotDiagnostics = gatedTab('diagnostics', 'Diagnostics', LotDiagnosticsTab);
export const LotEquipements = gatedTab('equipements', 'Équipements du lot', LotEquipementsTab);
export const LotCompteurs = gatedTab('releves', 'Compteurs', LotCompteursTab);
export const LotDocuments = gatedTab('documents', 'Documents du lot', LotDocumentsTab);
export const LotFinances = gatedTab('finances', 'Finances du lot', LotFinancesTab);
export const ImmeubleCharges = gatedTab('charges', 'Charges', ImmeubleChargesTab);
export const ImmeubleCopro = gatedTab('copropriete', 'Copropriété', ImmeubleCoproTab);
export const ImmeubleEquipements = gatedTab('equipements', 'Équipements communs', ImmeubleEquipementsTab);
export const ImmeubleDocuments = gatedTab('documents', 'Documents de l’immeuble', ImmeubleDocumentsTab);
export const ImmeubleInterventions = gatedTab('interventions', 'Interventions', ImmeubleInterventionsTab);
export const EquipementOverview = gatedTab('equipements', 'Équipement', EquipementOverviewTab);
export const EquipementEntretien = gatedTab('equipements', 'Entretien', EquipementEntretienTab);
export const EquipementInterventions = gatedTab('equipements', 'Interventions de l’équipement', EquipementInterventionsTab);
export const EquipementDocuments = gatedTab('equipements', 'Documents de l’équipement', EquipementDocumentsTab);

export const EquipementsScreen = gatedPage('equipements', 'Équipements', { label: 'Biens', href: biensPaths.lots }, EquipementsPage);
export const EquipementForm = gatedPage('equipements', 'Équipement', equipements, EquipementFormPage);
export const EquipementFiche = gatedPage('equipements', 'Équipement', equipements, EquipementFicheShell);
export const RelevesScreen = gatedPage('releves', 'Relevés de compteurs', { label: 'Biens', href: biensPaths.lots }, RelevesPage);
export const InventairesScreen = gatedPage('inventaires', 'Inventaires', { label: 'Biens', href: biensPaths.lots }, InventairesPage);
