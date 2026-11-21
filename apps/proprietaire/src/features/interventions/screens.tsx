"use client";

import {
  MaintenanceInterventionDetailPage,
  MaintenanceInterventionFormPage,
  MaintenanceInterventionsPage,
  MaintenanceSuppliersPage,
} from "@eguardimmo/gestion";
import { bindLot } from "@/features/locataires/LotBridge";

export const InterventionsApiScreen = bindLot(MaintenanceInterventionsPage);
export const InterventionFormApiScreen = bindLot(MaintenanceInterventionFormPage);
export const InterventionDetailApiScreen = bindLot(MaintenanceInterventionDetailPage);
export const PrestatairesApiScreen = bindLot(MaintenanceSuppliersPage);
