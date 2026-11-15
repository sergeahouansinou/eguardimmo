import { WORKS_CEILING_MINOR } from "@/features/shared/agencyDefaults";
import { contractorByName } from "./contractors";
import type { Intervention, InterventionEvent, Priority, Status } from "./schemas";

export interface RawDevisLine {
  label: string;
  quantity: number;
  unit: string;
  unitMinor: number;
}

export interface RawDevis {
  id: string;
  interventionId: string;
  title: string;
  contractor: string;
  issuedOn: string;
  state: "a_soumettre" | "soumis";
  lines: RawDevisLine[];
  vatBasisPoints: number;
  responseWithinHours: number;
  message: string;
  submittedOn: string | null;
}

interface Seed {
  id: string;
  subject: string;
  propertyLabel: string;
  commonParts?: boolean;
  lotId: string | null;
  mandantId: string;
  address: string;
  tenantId: string | null;
  contractor: string;
  passage?: string | null;
  dueOn: string | null;
  priority: Priority;
  priorityNote?: string | null;
  status: Status;
  description: string;
  reportedOn: string;
  reportedBy: string;
  completedOn?: string | null;
  estimatedMinor?: number | null;
  devisId?: string | null;
  events: InterventionEvent[];
}

function event(id: string, title: string, at: string, detail: string | null, tone: InterventionEvent["tone"] = "default"): InterventionEvent {
  return { id, title, at, detail, tone };
}

function build(seed: Seed): Intervention {
  const contractor = contractorByName(seed.contractor);
  const estimatedMinor = seed.estimatedMinor ?? null;
  return {
    id: seed.id,
    subject: seed.subject,
    propertyLabel: seed.propertyLabel,
    commonParts: seed.commonParts ?? false,
    lotId: seed.lotId,
    mandantId: seed.mandantId,
    address: seed.address,
    tenantId: seed.tenantId,
    contractor: seed.contractor,
    contractorContact: contractor?.contact ?? "",
    contractorPhone: contractor?.phone ?? "",
    passage: seed.passage ?? null,
    dueOn: seed.dueOn,
    priority: seed.priority,
    priorityNote: seed.priorityNote ?? null,
    status: seed.status,
    description: seed.description,
    reportedOn: seed.reportedOn,
    reportedBy: seed.reportedBy,
    completedOn: seed.completedOn ?? null,
    estimatedMinor,
    ceilingMinor: WORKS_CEILING_MINOR,
    approvalRequired: estimatedMinor !== null && estimatedMinor > WORKS_CEILING_MINOR,
    notifyTenant: true,
    notifyMandant: true,
    photos: [],
    devisId: seed.devisId ?? null,
    events: seed.events,
  };
}

function done(
  id: string,
  subject: string,
  property: { label: string; lotId: string | null; mandantId: string; address: string; tenantId: string | null; commonParts?: boolean },
  contractor: string,
  reportedOn: string,
  completedOn: string,
  priority: Priority,
  status: Status = "terminee",
): Intervention {
  return build({
    id,
    subject,
    propertyLabel: property.label,
    commonParts: property.commonParts ?? false,
    lotId: property.lotId,
    mandantId: property.mandantId,
    address: property.address,
    tenantId: property.tenantId,
    contractor,
    dueOn: completedOn,
    priority,
    status,
    description: `${subject}. Intervention réalisée et validée.`,
    reportedOn,
    reportedBy: "Cabinet Delmas Immobilier",
    completedOn,
    estimatedMinor: 18000,
    events: [
      event(`${id}-3`, "Intervention terminée", completedOn, contractor, "success"),
      event(`${id}-2`, "Intervenant assigné", reportedOn, contractor, "success"),
      event(`${id}-1`, "Intervention ouverte", reportedOn, "signalement par message"),
    ],
  });
}

export function seedInterventions(): Intervention[] {
  return [
    build({
      id: "fuite-sous-l-evier",
      subject: "Fuite sous l'évier",
      propertyLabel: "Studio 4",
      lotId: "studio-4",
      mandantId: "marc-chevalier",
      address: "Résidence du Parc, 75012 Paris",
      tenantId: "anais-roux",
      contractor: "Plomberie Sanvi",
      passage: "16/11/2026, matin",
      dueOn: "2026-11-16",
      priority: "urgente",
      priorityNote: "Fuite active",
      status: "devis_a_soumettre",
      description:
        "Fuite sous le lavabo de la cuisine : le siphon goutte et le dessous du meuble est humide. Le locataire a posé une bassine. Photo reçue le 12/11/2026.",
      reportedOn: "2026-11-11",
      reportedBy: "Anaïs Roux",
      estimatedMinor: 38000,
      devisId: "devis-plomberie-studio-4",
      events: [
        event("fuite-4", "Devis reçu, 380 € TTC", "2026-11-13", "Plomberie Sanvi", "warning"),
        event("fuite-3", "Plombier assigné", "2026-11-12", "passage proposé le 16/11", "success"),
        event("fuite-2", "Photo reçue du locataire", "2026-11-12T09:30", "evier-fuite.jpg"),
        event("fuite-1", "Intervention ouverte", "2026-11-11T18:02", "signalement par message"),
      ],
    }),
    build({
      id: "chauffe-eau-a-remplacer",
      subject: "Chauffe-eau à remplacer",
      propertyLabel: "Apt 7",
      lotId: "apt-7",
      mandantId: "famille-bernard",
      address: "7 avenue Foch, 75116 Paris",
      tenantId: "louis-petit",
      contractor: "Chauffage Martin",
      dueOn: "2026-11-30",
      priority: "normale",
      status: "ouverte",
      description: "Le chauffe-eau de 150 litres fuit par le groupe de sécurité et ne tient plus la température.",
      reportedOn: "2026-11-06",
      reportedBy: "Louis Petit",
      events: [
        event("chauffe-eau-2", "Intervenant assigné", "2026-11-07", "Chauffage Martin", "success"),
        event("chauffe-eau-1", "Intervention ouverte", "2026-11-06T14:20", "signalement par message"),
      ],
    }),
    build({
      id: "interphone-du-hall-en-panne",
      subject: "Interphone du hall en panne",
      propertyLabel: "Les Tilleuls",
      commonParts: true,
      lotId: null,
      mandantId: "paul-lemoine",
      address: "2 rue des Tilleuls, 75012 Paris",
      tenantId: null,
      contractor: "Électricité Bailly",
      passage: "20/11/2026, après-midi",
      dueOn: "2026-12-05",
      priority: "basse",
      status: "en_cours",
      description: "La platine de rue n'appelle plus les logements. Les locataires doivent descendre ouvrir.",
      reportedOn: "2026-11-04",
      reportedBy: "Hugo Perrin",
      estimatedMinor: 42000,
      devisId: "devis-electricite-les-tilleuls",
      events: [
        event("interphone-3", "Devis soumis au mandant, 420 € TTC", "2026-11-10", "Paul Lemoine, réponse sous 48 h", "default"),
        event("interphone-2", "Intervenant assigné", "2026-11-05", "Électricité Bailly", "success"),
        event("interphone-1", "Intervention ouverte", "2026-11-04T08:45", "signalement par message"),
      ],
    }),
    done("serrure-de-la-porte-d-entree", "Serrure de la porte d'entrée", { label: "Apt 9", lotId: "apt-9", mandantId: "famille-bernard", address: "9 avenue Foch, 75116 Paris", tenantId: "karim-haddad" }, "Serrurerie Dupont", "2026-10-02", "2026-10-04", "normale"),
    done("remplacement-de-la-vmc", "Remplacement de la VMC", { label: "Lot 2", lotId: "lot-2", mandantId: "sci-les-acacias", address: "Résidence Les Acacias, 75013 Paris", tenantId: "yann-morel" }, "Multiservices Azur", "2026-10-06", "2026-10-09", "normale"),
    done("radiateur-qui-ne-chauffe-pas", "Radiateur qui ne chauffe pas", { label: "Apt 5", lotId: "apt-5", mandantId: "helene-roussel", address: "5 rue des Lilas, 75020 Paris", tenantId: "ines-laurent" }, "Chauffage Martin", "2026-10-10", "2026-10-14", "urgente"),
    done("peinture-de-la-cage-d-escalier", "Peinture de la cage d'escalier", { label: "Résidence Les Acacias", lotId: null, mandantId: "sci-les-acacias", address: "Résidence Les Acacias, 75013 Paris", tenantId: null, commonParts: true }, "Peinture Lefèvre", "2026-10-12", "2026-10-17", "basse"),
    done("robinet-de-baignoire-qui-fuit", "Robinet de baignoire qui fuit", { label: "Apt 12", lotId: "apt-12", mandantId: "marc-chevalier", address: "12 rue de la Paix, 75002 Paris", tenantId: "thomas-girard" }, "Plomberie Sanvi", "2026-10-15", "2026-10-21", "normale"),
    done("ampoules-du-palier", "Ampoules du palier", { label: "Les Tilleuls", lotId: null, mandantId: "paul-lemoine", address: "2 rue des Tilleuls, 75012 Paris", tenantId: null, commonParts: true }, "Électricité Bailly", "2026-09-18", "2026-09-20", "basse"),
    done("fenetre-de-la-chambre-qui-ferme-mal", "Fenêtre de la chambre qui ferme mal", { label: "Apt 3", lotId: "apt-3", mandantId: "famille-bernard", address: "3 avenue Foch, 75116 Paris", tenantId: "julie-marchand" }, "Menuiserie Roche", "2026-09-02", "2026-09-09", "normale"),
    done("detecteur-de-fumee", "Détecteur de fumée", { label: "Maison de ville", lotId: "maison-de-ville", mandantId: "nadia-benali", address: "21 rue du Marché, 75007 Paris", tenantId: "mathieu-garnier" }, "Électricité Bailly", "2026-11-03", "2026-11-06", "normale"),
    done("debouchage-de-la-colonne-d-evacuation", "Débouchage de la colonne d'évacuation", { label: "Lot 1", lotId: "lot-1", mandantId: "sci-les-acacias", address: "Résidence Les Acacias, 75013 Paris", tenantId: "camille-dupuis" }, "Plomberie Sanvi", "2026-06-10", "2026-06-12", "urgente", "archivee"),
    done("changement-du-joint-de-la-douche", "Changement du joint de la douche", { label: "Apt 6", lotId: "apt-6", mandantId: "paul-lemoine", address: "6 rue des Tilleuls, 75012 Paris", tenantId: "lea-vidal" }, "Plomberie Sanvi", "2026-07-08", "2026-07-10", "basse", "archivee"),
  ];
}

export function seedDevis(): RawDevis[] {
  return [
    {
      id: "devis-plomberie-studio-4",
      interventionId: "fuite-sous-l-evier",
      title: "Devis plomberie, Studio 4",
      contractor: "Plomberie Sanvi",
      issuedOn: "2026-11-13",
      state: "a_soumettre",
      lines: [
        { label: "Déplacement et diagnostic", quantity: 1, unit: "", unitMinor: 6000 },
        { label: "Main-d'œuvre, plombier", quantity: 2, unit: "h", unitMinor: 7000 },
        { label: "Fournitures : siphon, flexibles, joints", quantity: 1, unit: "", unitMinor: 8500 },
        { label: "Séchage et reprise du dessous d'évier", quantity: 1, unit: "", unitMinor: 9500 },
      ],
      vatBasisPoints: 1000,
      responseWithinHours: 48,
      message:
        "Bonjour Marc, voici le devis de la fuite du Studio 4. Une réponse sous 48 heures nous permet de maintenir le passage du 16 novembre.",
      submittedOn: null,
    },
    {
      id: "devis-electricite-les-tilleuls",
      interventionId: "interphone-du-hall-en-panne",
      title: "Devis électricité, Les Tilleuls",
      contractor: "Électricité Bailly",
      issuedOn: "2026-11-09",
      state: "soumis",
      lines: [
        { label: "Déplacement et diagnostic", quantity: 1, unit: "", unitMinor: 6000 },
        { label: "Platine de rue et alimentation", quantity: 1, unit: "", unitMinor: 27000 },
        { label: "Main-d'œuvre, électricien", quantity: 2, unit: "h", unitMinor: 4500 },
      ],
      vatBasisPoints: 1000,
      responseWithinHours: 48,
      message: "Bonjour Paul, voici le devis pour le remplacement de l'interphone du hall. Merci de nous indiquer votre accord.",
      submittedOn: "2026-11-10",
    },
  ];
}
