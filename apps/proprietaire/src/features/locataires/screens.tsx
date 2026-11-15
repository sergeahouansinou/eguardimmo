"use client";

import {
  AttestationApercuPage,
  AvisEcheanceApercuPage,
  AvisEcheancePage,
  BailDetailPage,
  BailEcheancierPage,
  BailFormPage,
  BailSortiePage,
  BauxPage,
  CandidatDossierPage,
  CandidatInvitePage,
  CandidatsPage,
  CourrierApercuPage,
  CourrierFormPage,
  CourriersPage,
  EtatLieuxFormPage,
  EtatLieuxPage,
  EtatsLieuxPage,
  LocataireDetailPage,
  LocataireFormPage,
  LocatairesPage,
  ModeleApercuPage,
  ModeleFormPage,
  ModelesPage,
  QuittanceApercuPage,
  QuittancesPage,
  ReservationsPage,
  SignatureNewPage,
  SignaturesPage,
} from "@eguardimmo/gestion";
import { bindLot } from "./LotBridge";

export const LocatairesScreen = bindLot(LocatairesPage);
export const LocataireDetailScreen = bindLot(LocataireDetailPage);
export const LocataireFormScreen = bindLot(LocataireFormPage);
export const CandidatsScreen = bindLot(CandidatsPage);
export const CandidatInviteScreen = bindLot(CandidatInvitePage);
export const CandidatDossierScreen = bindLot(CandidatDossierPage);

export const BauxScreen = bindLot(BauxPage);
export const BailDetailScreen = bindLot(BailDetailPage);
export const BailFormScreen = bindLot(BailFormPage);
export const BailEcheancierScreen = bindLot(BailEcheancierPage);
export const BailSortieScreen = bindLot(BailSortiePage);
export const EtatsLieuxScreen = bindLot(EtatsLieuxPage);
export const EtatLieuxScreen = bindLot(EtatLieuxPage);
export const EtatLieuxFormScreen = bindLot(EtatLieuxFormPage);
export const ReservationsScreen = bindLot(ReservationsPage);

export const CourriersScreen = bindLot(CourriersPage);
export const CourrierFormScreen = bindLot(CourrierFormPage);
export const CourrierApercuScreen = bindLot(CourrierApercuPage);
export const ModelesScreen = bindLot(ModelesPage);
export const ModeleFormScreen = bindLot(ModeleFormPage);
export const ModeleApercuScreen = bindLot(ModeleApercuPage);
export const QuittancesScreen = bindLot(QuittancesPage);
export const QuittanceApercuScreen = bindLot(QuittanceApercuPage);
export const AvisEcheanceScreen = bindLot(AvisEcheancePage);
export const AvisEcheanceApercuScreen = bindLot(AvisEcheanceApercuPage);
export const AttestationApercuScreen = bindLot(AttestationApercuPage);
export const SignaturesScreen = bindLot(SignaturesPage);
export const SignatureNewScreen = bindLot(SignatureNewPage);
