"use client";

import { DossierRecouvrementPage, DossiersRecouvrementPage, ImpayesRecouvrementPage } from "@eguardimmo/gestion";
import { bindLot } from "@/features/locataires/LotBridge";

export const ImpayesRecouvrementScreen = bindLot(ImpayesRecouvrementPage);
export const DossiersRecouvrementScreen = bindLot(DossiersRecouvrementPage);
export const DossierRecouvrementScreen = bindLot(DossierRecouvrementPage);
