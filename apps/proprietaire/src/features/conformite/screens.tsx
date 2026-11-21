"use client";

import { ConformitePage, DocumentsConformitePage, PieceConformitePage } from "@eguardimmo/gestion";
import { bindLot } from "@/features/locataires/LotBridge";

export const ConformiteScreen = bindLot(ConformitePage);
export const PieceConformiteScreen = bindLot(PieceConformitePage);
export const DocumentsConformiteScreen = bindLot(DocumentsConformitePage);
