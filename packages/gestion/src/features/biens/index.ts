export { BiensProviders } from './provider';
export { BiensRoot } from './BiensRoot';
export type { BiensRootProps } from './BiensRoot';
export type { BiensProvidersProps } from './provider';
export type { BiensEnvironment } from './environment';
export { createDemoBiensSource } from './demo/store';
export { BiensSourceProvider } from './source';
export type { BiensSource } from './source';
export { BIENS_FEATURES, biensFeatureLabel } from './capabilities';
export type { BiensFeature } from './capabilities';
export { BiensError, BiensStaleVersionError, isStaleVersion } from './errors';
export type { BiensErrorKind } from './errors';
export { createApiBiensSource } from './api/apiSource';
export type { ApiBiensExtras, ApiBiensSource, ApiBiensSourceDependencies, ApiBiensSourceOptions, LotNode, Ownership } from './api/apiSource';
export type { OwnershipInput } from './api/apiPayloads';
export type { Page, PropertyPageQuery, UnitPageQuery } from './api/apiReads';
export { SLUG_PATTERN, biensPaths } from './paths';
export { LotsScreen } from './screens/lots/LotsScreen';
export { LotForm } from './screens/lots/LotForm';
export { LotFiche } from './screens/lots/LotFiche';
export { LotOverview } from './screens/lots/LotOverview';
export { LotCarac } from './screens/lots/LotCarac';
export { LotLocations } from './screens/lots/LotLocations';
export { ImmeublesScreen } from './screens/immeubles/ImmeublesScreen';
export { ImmeubleForm } from './screens/immeubles/ImmeubleForm';
export { ImmeubleFiche } from './screens/immeubles/ImmeubleFiche';
export { ImmeubleOverview } from './screens/immeubles/ImmeubleOverview';
export { ImmeubleLots } from './screens/immeubles/ImmeubleLots';
export {
  LotDiagnostics,
  LotEquipements,
  LotCompteurs,
  LotDocuments,
  LotFinances,
  ImmeubleCharges,
  ImmeubleCopro,
  ImmeubleEquipements,
  ImmeubleDocuments,
  ImmeubleInterventions,
  EquipementsScreen,
  EquipementForm,
  EquipementFiche,
  EquipementOverview,
  EquipementEntretien,
  EquipementInterventions,
  EquipementDocuments,
  RelevesScreen,
  InventairesScreen,
} from './gatedPages';
