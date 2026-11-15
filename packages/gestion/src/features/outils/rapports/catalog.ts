import {
  Banknote,
  BellRing,
  Building2,
  Calculator,
  CalendarClock,
  ChartLine,
  ClipboardList,
  HandCoins,
  Landmark,
  Percent,
  PiggyBank,
  ReceiptText,
  Scale,
  ShieldCheck,
  Table,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { slugify } from '../kit';

export interface ReportType {
  slug: string;
  label: string;
  description: string;
  group: string;
  icon: LucideIcon;
  fiscal: boolean;
}

interface Seed {
  label: string;
  description: string;
  icon: LucideIcon;
  fiscal?: boolean;
}

const GROUPS: { label: string; fiscal?: boolean; reports: Seed[] }[] = [
  {
    label: 'Loyers et encaissements',
    reports: [
      { label: 'Loyers appelés', description: 'Avis émis sur la période', icon: ReceiptText },
      { label: 'Loyers encaissés', description: 'Paiements reçus, par bien', icon: Banknote },
      { label: 'Loyers impayés', description: 'Restes dus et ancienneté', icon: BellRing },
      { label: 'Soldes des locataires', description: 'Situation de chaque compte', icon: Scale },
    ],
  },
  {
    label: 'Charges et dépenses',
    reports: [
      { label: 'Dépenses par bien', description: 'Travaux, taxes, assurances', icon: Wallet },
      { label: 'Régularisation des charges', description: 'Provisions et dépenses réelles', icon: Calculator },
      { label: 'Dépôts de garantie', description: 'Montants reçus et restitués', icon: PiggyBank },
    ],
  },
  {
    label: 'Baux et occupation',
    reports: [
      { label: 'État locatif', description: 'Lots, locataires et loyers', icon: ClipboardList },
      { label: 'Échéances et révisions', description: 'Fins de bail et indexations', icon: CalendarClock },
      { label: 'Occupants des biens', description: 'Locataires et colocataires', icon: Users },
      { label: 'Diagnostics et assurances', description: 'Validités et pièces manquantes', icon: ShieldCheck },
    ],
  },
  {
    label: 'Fiscalité et comptabilité',
    fiscal: true,
    reports: [
      { label: 'Revenus fonciers', description: 'Aide à la déclaration annuelle', icon: Landmark },
      { label: 'Export comptable', description: 'Écritures au format CSV', icon: Table },
      { label: 'TVA collectée et payée', description: 'Pour les locations soumises', icon: Percent },
    ],
  },
  {
    label: 'Patrimoine',
    reports: [
      { label: "Valeur des biens", description: "Prix d'achat et estimation", icon: Building2 },
      { label: 'Prêts immobiliers', description: 'Capital restant et intérêts', icon: HandCoins },
      { label: 'Rentabilité par bien', description: 'Rendement brut et net', icon: ChartLine },
    ],
  },
];

export const REPORT_GROUPS = GROUPS.map((group) => ({
  label: group.label,
  reports: group.reports.map(
    (seed): ReportType => ({
      slug: slugify(seed.label),
      label: seed.label,
      description: seed.description,
      group: group.label,
      icon: seed.icon,
      fiscal: group.fiscal === true,
    }),
  ),
}));

export const REPORT_TYPES: ReportType[] = REPORT_GROUPS.flatMap((group) => group.reports);

export const MODELED_SLUG = 'loyers-encaisses';

export const findReport = (slug: string): ReportType | undefined => REPORT_TYPES.find((report) => report.slug === slug);

export const reportHref = (slug: string): string => `/rapports/${slug}`;
