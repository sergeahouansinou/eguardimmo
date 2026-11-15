import { DEMO_TODAY } from "@/lib/dates";
import { demoBaux, demoEvents, demoInterventions, demoLocataires, demoMessages } from "./demoBaux";
import { demoAvis, demoInvitations } from "./demoExtra";
import { demoBiens, demoCompliance, demoMandants, demoMandats } from "./demoCore";
import type { PortefeuilleData } from "./schemas";

export function createDemoData(): PortefeuilleData {
  return structuredClone({
    agencyName: "Cabinet Delmas Immobilier",
    managerFirstName: "Sophie",
    todayIso: DEMO_TODAY,
    mandants: demoMandants,
    mandats: demoMandats,
    biens: demoBiens,
    locataires: demoLocataires,
    baux: demoBaux,
    events: demoEvents,
    interventions: demoInterventions,
    messages: demoMessages,
    compliance: demoCompliance,
    avenants: [],
    invitations: demoInvitations,
    avis: demoAvis,
  });
}
