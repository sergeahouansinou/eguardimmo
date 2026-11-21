"use client";

import {
  AvisEcheanceLoyerPage,
  BankingAccountsPage,
  BankingImportPage,
  BankingLinesPage,
  BankingReconciliationDetailPage,
  BankingReconciliationsPage,
  BankingStatementDetailPage,
  BankingStatementsPage,
  BailDetailPage,
  BailEcheancierPage,
  BailFormPage,
  BailSortiePage,
  BauxPage,
  CandidatDossierPage,
  CandidatInvitePage,
  CandidatsPage,
  ChargesExerciseDetailPage,
  ChargesExerciseFormPage,
  ChargesExercisesPage,
  ChargesExpenseDetailPage,
  ChargesExpenseFormPage,
  ChargesExpensesPage,
  ChargesKeysPage,
  ChargesStatementPage,
  ConformitePage,
  DossierRecouvrementPage,
  DocumentsConformitePage,
  DossiersRecouvrementPage,
  EcheanceLoyerDetailPage,
  EcheancesLoyerPage,
  EquipeInvitePage,
  EquipePage,
  EquipeRolesPage,
  EtatLieuxComparePage,
  EtatLieuxFormPage,
  FacturationFactureDetailPage,
  MaintenanceInterventionDetailPage,
  MaintenanceInterventionFormPage,
  MaintenanceInterventionsPage,
  MaintenanceQuotesPage,
  MaintenanceSuppliersPage,
  OwnerFundsBatchPage,
  OwnerFundsClosingPage,
  OwnerFundsFeesPage,
  OwnerFundsMandantPage,
  OwnerFundsPayoutsPage,
  OwnerFundsSimulationPage,
  OwnerFundsRequestsPage,
  OwnerFundsTrustPage,
  ReportingAgencyHomePage,
  ReportingGeneratePage,
  ReportingReportPage,
  ReportingReportsPage,
  ReportingStatementPage,
  FacturationFactureFormPage,
  FacturationFacturesPage,
  IdentiteLegalePage,
  ImpayesRecouvrementPage,
  InvitationLocatairePage,
  LocataireDetailPage,
  LocataireFormPage,
  LocatairesPage,
  PaiementLoyerFormPage,
  PaiementsLoyerPage,
  PieceConformitePage,
  QuittanceLoyerDetailPage,
  QuittancesLoyerPage,
  ReservationContratPage,
  ReservationFormPage,
  ReservationsPage,
  TenantInspectionDetailPage,
  TenantInspectionFormPage,
  TenantInspectionsPage,
  TenantInsurancePage,
  TenantNoticeDetailPage,
  TenantNoticesPage,
  TenantOnlinePaymentsPage,
  TenantRequestsDigest,
  ActivityJournalPage,
  AnalyticsHubPage,
  OccupancyPage,
  RevenueExpensesPage,
  TaxDetailPage,
  TaxPage,
  DirectoryContactDetailPage,
  DirectoryContactFormPage,
  DirectoryContactsPage,
  PlanningAgendaPage,
  PlanningEventDetailPage,
  PlanningEventFormPage,
  PlanningTaskDetailPage,
  PlanningTaskFormPage,
  PlanningTasksPage,
  TimezoneSettingsPage,
} from "@eguardimmo/gestion";
import { bindLot, bindScreen } from "./bind";

export const LocatairesScreen = bindLot(LocatairesPage);
export const LocataireDetailScreen = bindLot(LocataireDetailPage);
export const LocataireFormScreen = bindLot(LocataireFormPage);
export const CandidatsScreen = bindLot(CandidatsPage);
export const CandidatInviteScreen = bindLot(CandidatInvitePage);
export const CandidatDossierScreen = bindLot(CandidatDossierPage);

export const IdentiteLegaleScreen = bindLot(IdentiteLegalePage);
export const AvisEcheanceScreen = bindLot(AvisEcheanceLoyerPage);
export const InvitationLocataireScreen = bindLot(InvitationLocatairePage);

export const BauxScreen = bindLot(BauxPage);
export const BailDetailScreen = bindLot(BailDetailPage);
export const BailFormScreen = bindLot(BailFormPage);
export const BailEcheancierScreen = bindLot(BailEcheancierPage);
export const BailSortieScreen = bindLot(BailSortiePage);
export const EtatsLieuxScreen = bindLot(TenantInspectionsPage);
export const EtatLieuxScreen = bindLot(TenantInspectionDetailPage);
export const EtatLieuxCompareScreen = bindLot(EtatLieuxComparePage);
export const EtatLieuxFormScreen = bindLot(TenantInspectionFormPage);
export const EtatLieuxModifierScreen = bindLot(EtatLieuxFormPage);
export const CongesScreen = bindLot(TenantNoticesPage);
export const CongeDetailScreen = bindLot(TenantNoticeDetailPage);
export const AssurancesScreen = bindLot(TenantInsurancePage);
export const PaiementsEnLigneScreen = bindLot(TenantOnlinePaymentsPage);
export const DemandesLocatairesScreen = bindLot(TenantRequestsDigest);
export const ReservationsScreen = bindLot(ReservationsPage);
export const ReservationFormScreen = bindLot(ReservationFormPage);
export const ReservationContratScreen = bindLot(ReservationContratPage);

export const EquipeScreen = bindScreen(EquipePage);
export const EquipeInviteScreen = bindScreen(EquipeInvitePage);
export const EquipeRolesScreen = bindScreen(EquipeRolesPage);

export const LoyersScreen = bindLot(EcheancesLoyerPage);
export const LoyerDetailScreen = bindLot(EcheanceLoyerDetailPage);
export const LoyersPaiementsScreen = bindLot(PaiementsLoyerPage);
export const LoyerPaiementFormScreen = bindLot(PaiementLoyerFormPage);
export const LoyersQuittancesScreen = bindLot(QuittancesLoyerPage);
export const LoyerQuittanceDetailScreen = bindLot(QuittanceLoyerDetailPage);

export const ImpayesRecouvrementScreen = bindLot(ImpayesRecouvrementPage);
export const DossiersRecouvrementScreen = bindLot(DossiersRecouvrementPage);
export const DossierRecouvrementScreen = bindLot(DossierRecouvrementPage);

export const FacturesScreen = bindLot(FacturationFacturesPage);
export const FactureFormScreen = bindLot(FacturationFactureFormPage);
export const FactureDetailScreen = bindLot(FacturationFactureDetailPage);

export const ConformiteApiScreen = bindLot(ConformitePage);
export const PieceConformiteApiScreen = bindLot(PieceConformitePage);
export const DocumentsConformiteScreen = bindLot(DocumentsConformitePage);

export const InterventionsApiScreen = bindLot(MaintenanceInterventionsPage);
export const InterventionFormApiScreen = bindLot(MaintenanceInterventionFormPage);
export const InterventionDetailApiScreen = bindLot(MaintenanceInterventionDetailPage);
export const PrestatairesApiScreen = bindLot(MaintenanceSuppliersPage);
export const DevisApiScreen = bindLot(MaintenanceQuotesPage);

export const ReversementsApiScreen = bindLot(OwnerFundsPayoutsPage);
export const ReversementLotApiScreen = bindLot(OwnerFundsBatchPage);
export const ReversementMandantApiScreen = bindLot(OwnerFundsMandantPage);
export const DemandesIbanApiScreen = bindLot(OwnerFundsRequestsPage);
export const HonorairesApiScreen = bindLot(OwnerFundsFeesPage);
export const BaremeApiScreen = bindLot(OwnerFundsSimulationPage);
export const FondsTiersApiScreen = bindLot(OwnerFundsTrustPage);
export const ClotureApiScreen = bindLot(OwnerFundsClosingPage);

export const DepensesScreen = bindLot(ChargesExpensesPage);
export const DepenseFormScreen = bindLot(ChargesExpenseFormPage);
export const DepenseDetailScreen = bindLot(ChargesExpenseDetailPage);
export const ChargesExercicesScreen = bindLot(ChargesExercisesPage);
export const ChargesExerciceFormScreen = bindLot(ChargesExerciseFormPage);
export const ChargesExerciceDetailScreen = bindLot(ChargesExerciseDetailPage);
export const ChargesDecompteScreen = bindLot(ChargesStatementPage);
export const ChargesClesScreen = bindLot(ChargesKeysPage);

export const BanquePointageScreen = bindLot(BankingLinesPage);
export const BanqueComptesScreen = bindLot(BankingAccountsPage);
export const BanqueRelevesScreen = bindLot(BankingStatementsPage);
export const BanqueReleveDetailScreen = bindLot(BankingStatementDetailPage);
export const BanqueImportScreen = bindLot(BankingImportPage);
export const BanqueEtatsScreen = bindLot(BankingReconciliationsPage);
export const BanqueEtatDetailScreen = bindLot(BankingReconciliationDetailPage);

export const AccueilApiScreen = bindLot(ReportingAgencyHomePage);
export const ComptesRendusApiScreen = bindLot(ReportingReportsPage);
export const CompteRenduGenerationApiScreen = bindLot(ReportingGeneratePage);
export const CompteRenduApiScreen = bindLot(ReportingReportPage);
export const ReleveMandantApiScreen = bindLot(ReportingStatementPage);

export const AgendaScreen = bindLot(PlanningAgendaPage);
export const EvenementFormScreen = bindLot(PlanningEventFormPage);
export const EvenementDetailScreen = bindLot(PlanningEventDetailPage);
export const TachesScreen = bindLot(PlanningTasksPage);
export const TacheFormScreen = bindLot(PlanningTaskFormPage);
export const TacheDetailScreen = bindLot(PlanningTaskDetailPage);
export const ContactsScreen = bindLot(DirectoryContactsPage);
export const ContactFormScreen = bindLot(DirectoryContactFormPage);
export const ContactDetailScreen = bindLot(DirectoryContactDetailPage);
export const JournalScreen = bindLot(ActivityJournalPage);
export const FuseauHoraireScreen = bindLot(TimezoneSettingsPage);

export const AnalytiqueScreen = bindLot(AnalyticsHubPage);
export const AnalytiqueRevenusScreen = bindLot(RevenueExpensesPage);
export const AnalytiqueOccupationScreen = bindLot(OccupancyPage);
export const FiscaliteScreen = bindLot(TaxPage);
export const FiscaliteDetailScreen = bindLot(TaxDetailPage);
