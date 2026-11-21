"use client";

import { ReportingLandlordHomePage } from "@eguardimmo/gestion";
import { bindLot } from "@/features/locataires/LotBridge";

export const AccueilApiScreen = bindLot(ReportingLandlordHomePage);
