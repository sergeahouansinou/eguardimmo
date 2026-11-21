"use client";

import {
  EcheanceLoyerDetailPage,
  EcheancesLoyerPage,
  PaiementLoyerFormPage,
  PaiementsLoyerPage,
  QuittanceLoyerDetailPage,
  QuittancesLoyerPage,
} from "@eguardimmo/gestion";
import { bindLot } from "@/features/locataires/LotBridge";

export const LoyersScreen = bindLot(EcheancesLoyerPage);
export const LoyerDetailScreen = bindLot(EcheanceLoyerDetailPage);
export const LoyersPaiementsScreen = bindLot(PaiementsLoyerPage);
export const LoyerPaiementFormScreen = bindLot(PaiementLoyerFormPage);
export const LoyersQuittancesScreen = bindLot(QuittancesLoyerPage);
export const LoyerQuittanceDetailScreen = bindLot(QuittanceLoyerDetailPage);
