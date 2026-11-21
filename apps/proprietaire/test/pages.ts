import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface PageFile {
  route: string;
  file: string;
}

export const CONFIE_DIR = join(process.cwd(), "src", "app", "(confie)");

export function pageFiles(directory: string = CONFIE_DIR): PageFile[] {
  const pages: PageFile[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(current, entry.name));
      else if (entry.name === "page.tsx") {
        const segments = relative(directory, current)
          .split(sep)
          .filter((segment) => segment !== "" && !(segment.startsWith("(") && segment.endsWith(")")));
        pages.push({ route: `/${segments.map((segment) => (segment.startsWith("[") ? "x" : segment)).join("/")}`, file: join(current, entry.name) });
      }
    }
  };
  walk(directory);
  return pages;
}

export const API_SERVED_ROUTES: readonly string[] = ["/confie", "/confie/agence", "/confie/agence/mandat", "/confie/agence/mandat/fin", "/confie/compte-de-paiement", "/confie/informations", "/confie/informations/modifier", "/confie/securite", "/confie/notifications", "/confie/notifications/toutes", "/confie/biens", "/confie/biens/x", "/confie/baux", "/confie/baux/x", "/confie/loyers", "/confie/loyers/x", "/confie/releve", "/confie/charges", "/confie/charges/x", "/confie/comptes-rendus", "/confie/comptes-rendus/x", "/confie/comptes-rendus/x/apercu", "/confie/documents", "/confie/fiscalite", "/confie/fiscalite/x", "/confie/factures", "/confie/factures/x", "/confie/interventions", "/confie/interventions/x", "/confie/interventions/x/devis", "/confie/messages", "/confie/messages/nouveau", "/confie/messages/x", "/confie/annonces", "/confie/annonces/x", "/confie/support", "/confie/support/nouvelle", "/confie/support/x"];
