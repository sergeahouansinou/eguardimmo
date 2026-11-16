"use client";

import {
  BailDetailPage,
  BailEcheancierPage,
  BailFormPage,
  BailSortiePage,
  BauxPage,
  CandidatDossierPage,
  CandidatInvitePage,
  CandidatsPage,
  EquipeInvitePage,
  EquipePage,
  EtatLieuxComparePage,
  EtatLieuxFormPage,
  EtatLieuxPage,
  EtatsLieuxPage,
  LocataireDetailPage,
  LocataireFormPage,
  LocatairesPage,
  ReservationContratPage,
  ReservationFormPage,
  ReservationsPage,
} from "@eguardimmo/gestion";
import { bindLot, bindScreen } from "./bind";

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
export const EtatLieuxCompareScreen = bindLot(EtatLieuxComparePage);
export const EtatLieuxFormScreen = bindLot(EtatLieuxFormPage);
export const ReservationsScreen = bindLot(ReservationsPage);
export const ReservationFormScreen = bindLot(ReservationFormPage);
export const ReservationContratScreen = bindLot(ReservationContratPage);

export const EquipeScreen = bindScreen(EquipePage);
export const EquipeInviteScreen = bindScreen(EquipeInvitePage);
