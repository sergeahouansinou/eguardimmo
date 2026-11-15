import { describe, expect, it } from 'vitest';
import { demoSeeds } from '../demo';
import type { MessagerieSpace } from '../demo';

interface RouteTable {
  prefix: string;
  pages: readonly string[];
  dynamic: Readonly<Record<string, readonly string[]>>;
}

const agence: RouteTable = {
  prefix: '',
  pages: [
    '/', '/mandants', '/mandants/nouveau', '/mandats', '/mandats/nouveau', '/biens', '/locataires', '/baux', '/baux/nouveau',
    '/finances/encaissements', '/finances/encaissements/nouveau', '/finances/impayes', '/finances/reversements', '/finances/reversements/lot',
    '/finances/honoraires', '/finances/honoraires/bareme', '/comptes-rendus', '/comptes-rendus/nouveau', '/messages', '/messages/nouveau',
    '/campagnes', '/campagnes/nouvelle', '/devis', '/interventions', '/interventions/nouvelle', '/conformite', '/documents', '/documents/ajout',
    '/reglages', '/reglages/finances', '/equipe', '/equipe/invitation', '/equipe/roles', '/compte', '/compte/securite', '/compte/notifications',
    '/compte/abonnement', '/aide',
  ],
  dynamic: {
    '/mandats/:id': ['m-2025-0142', 'm-2024-0058', 'm-2023-0071', 'm-2022-0019', 'm-2024-0033', 'm-2025-0201'],
    '/mandants/:id': ['marc-chevalier', 'famille-bernard', 'helene-roussel', 'sci-les-acacias', 'paul-lemoine', 'nadia-benali'],
    '/baux/:id': ['b-2024-018', 'b-2026-007', 'b-2025-009', 'b-2026-004', 'b-2025-021', 'b-2025-013', 'b-2026-016', 'b-2025-005', 'b-2024-029', 'b-2026-010', 'b-2023-017', 'b-2024-031', 'b-2024-003', 'b-2026-001'],
    '/biens/:id': ['apt-12', 'studio-4', 'apt-3', 'apt-7', 'apt-9'],
    '/locataires/:id': ['anais-roux', 'thomas-girard', 'louis-petit', 'sarah-mensah'],
    '/interventions/:id': ['fuite-sous-l-evier', 'chauffe-eau-a-remplacer', 'interphone-du-hall-en-panne'],
  },
};

const mandant: RouteTable = {
  prefix: '/confie',
  pages: [
    '/confie', '/confie/biens', '/confie/loyers', '/confie/comptes-rendus', '/confie/fiscalite', '/confie/fiscalite/declaration-2044',
    '/confie/documents', '/confie/interventions', '/confie/agence', '/confie/agence/mandat', '/confie/agence/mandat/fin', '/confie/informations',
    '/confie/informations/modifier', '/confie/securite', '/confie/notifications', '/confie/messages', '/confie/messages/nouveau', '/confie/aide',
  ],
  dynamic: {
    '/confie/biens/:id': ['apt-12', 'studio-4'],
    '/confie/comptes-rendus/:id': ['t4-2026', 't3-2026', 't2-2026', 't1-2026', 't4-2025'],
    '/confie/interventions/:id': ['fuite-sous-l-evier', 'remplacement-de-la-serrure'],
    '/confie/interventions/:id/devis': ['fuite-sous-l-evier'],
  },
};

const bailleur: RouteTable = {
  prefix: '',
  pages: [
    '/', '/biens', '/biens/immeubles', '/biens/equipements', '/biens/releves', '/biens/inventaires', '/locataires', '/locataires/candidats',
    '/baux', '/baux/etats-des-lieux', '/baux/reservations', '/finances', '/finances/impayes', '/finances/factures', '/finances/regularisation',
    '/finances/bilan', '/finances/prets', '/finances/import-bancaire', '/documents', '/documents/quittances', '/documents/avis-echeance',
    '/documents/courriers', '/documents/signatures', '/messages', '/messages/nouveau', '/campagnes', '/campagnes/nouvelle', '/interventions',
    '/interventions/nouvelle', '/agenda', '/taches', '/analytique', '/rapports', '/modeles', '/contacts', '/reglages', '/equipe', '/compte', '/compte/export',
    '/aide', '/aide/support', '/aide/raccourcis', '/aide/nouveautes', '/aide/signaler',
  ],
  dynamic: {
    '/baux/:id': ['apt-a1', 'studio-b3', 'apt-a3', 'apt-b2', 'studio-c2', 'apt-b1', 'studio-2e', 'villa-rdc', 'apt-a2'],
    '/locataires/:id': ['koffi-adjovi', 'ibrahim-yao', 'clarisse-hounkpatin', 'marc-dossou', 'nadege-sossou'],
    '/interventions/:id': ['fuite-sous-evier', 'chauffe-eau-a-remplacer', 'peinture-cage-d-escalier', 'remplacement-de-la-serrure', 'detartrage-de-la-chaudiere'],
  },
};

const locataire: RouteTable = {
  prefix: '',
  pages: [
    '/', '/loyers', '/loyers/payer', '/loyers/prelevement', '/loyers/regularisation', '/interventions', '/interventions/nouvelle', '/messages',
    '/messages/nouveau', '/bail', '/bail/conge', '/etats-des-lieux', '/documents', '/assurance', '/assurance/deposer', '/aide', '/compte',
    '/compte/modifier', '/compte/securite', '/notifications',
  ],
  dynamic: {
    '/interventions/:id': ['INT-2026-0147', 'INT-2026-0061'],
  },
};

const consoleTable: RouteTable = { prefix: '', pages: ['/'], dynamic: {} };

const tables: Record<MessagerieSpace, RouteTable> = {
  agence,
  proprietaire: mandant,
  bailleur,
  locataire,
  console: consoleTable,
};

function resolves(table: RouteTable, href: string): boolean {
  const full = `${table.prefix}${href}`;
  if (table.pages.includes(full)) return true;
  const segments = full.split('/');
  return Object.entries(table.dynamic).some(([pattern, ids]) => {
    const parts = pattern.split('/');
    if (parts.length !== segments.length) return false;
    let id: string | undefined;
    for (const [index, part] of parts.entries()) {
      if (part === ':id') id = segments[index];
      else if (part !== segments[index]) return false;
    }
    return id !== undefined && ids.includes(id);
  });
}

function linksOf(space: MessagerieSpace): { origin: string; href: string }[] {
  const seed = demoSeeds[space]();
  const fromConversations = seed.conversations.flatMap((conversation) =>
    conversation.links.map((link) => ({ origin: `conversation ${conversation.id}, ${link.label}`, href: link.href })),
  );
  const fromHelp = seed.help.categories.flatMap((category) =>
    category.articles.flatMap((article) => (article.href ? [{ origin: `aide ${article.id}`, href: article.href }] : [])),
  );
  return [...fromConversations, ...fromHelp];
}

const spaces = Object.keys(tables) as MessagerieSpace[];

describe('liens des fixtures de messagerie', () => {
  it.each(spaces)('%s : chaque lien pointe vers une route et un identifiant existants', (space) => {
    const table = tables[space];
    const unresolved = linksOf(space).filter((link) => !resolves(table, link.href));
    expect(unresolved).toEqual([]);
  });

  it.each(['agence', 'proprietaire', 'bailleur', 'locataire'] as const)('%s : les conversations portent au moins un lien', (space) => {
    expect(demoSeeds[space]().conversations.some((conversation) => conversation.links.length > 0)).toBe(true);
  });

  it('refuse un identifiant ou une route inconnus', () => {
    expect(resolves(agence, '/baux/studio-4')).toBe(false);
    expect(resolves(agence, '/interventions/fuite-studio-4')).toBe(false);
    expect(resolves(mandant, '/interventions/devis-plomberie')).toBe(false);
    expect(resolves(mandant, '/interventions/fuite-sous-l-evier/devis')).toBe(true);
    expect(resolves(bailleur, '/baux/apt-b2-introuvable')).toBe(false);
    expect(resolves(bailleur, '/inconnue')).toBe(false);
    expect(resolves(locataire, '/interventions/INT-2026-0147')).toBe(true);
  });
});
