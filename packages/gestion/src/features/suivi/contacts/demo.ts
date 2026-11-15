import { createCollection } from '../../outils/kit';
import { uniqueSlug } from '../shared/ids';
import type { BienId } from '../shared/biens';
import { contactInputSchema } from './schemas';
import type { Category, Contact } from './schemas';
import type { ContactsSource } from './source';

const make = (
  name: string,
  subtitle: string,
  category: Category,
  detail: string,
  phone: string,
  email: string,
  bienIds: BienId[],
  shared = false,
  archived = false,
): Contact => ({
  id: name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''),
  name,
  subtitle,
  category,
  detail,
  phone,
  email,
  bienIds,
  shared,
  archived,
});

export const demoContacts: readonly Contact[] = [
  make('Plomberie Sanvi', 'Rodrigue Sanvi', 'artisan', 'plombier', '+33 6 12 40 18 77', 'contact@plomberie-sanvi.example', ['apt-a1', 'apt-b3', 'villa-rdc'], true),
  make('Peinture Dupont', 'Sylvie Dupont', 'artisan', 'peintre', '+33 6 48 02 61 15', 'devis@peinture-dupont.example', ['residence-du-parc']),
  make('Cabinet Lefèvre', 'Syndic de copropriété', 'syndic', '', '+33 1 43 55 20 10', 'syndic@cabinet-lefevre.example', ['les-tilleuls']),
  make('Mutuelle Atlantique', 'Contrat PNO 22-48 117', 'assureur', '', '+33 5 56 90 14 22', 'sinistres@mutuelle-atlantique.example', ['apt-a1', 'apt-b3', 'villa-rdc', 'residence-du-parc']),
  make('Hélène Adjovi', 'Garante de Koffi Adjovi', 'garant', '', '+33 6 21 33 09 84', 'helene.adjovi@example.com', ['apt-a1']),
  make('Électricité Hounsou', 'Gaston Hounsou', 'artisan', 'électricien', '+33 6 33 18 72 40', 'contact@electricite-hounsou.example', ['apt-b3', 'villa-rdc']),
  make('Chauffage Mensah', 'Éric Mensah', 'artisan', 'chauffagiste', '+33 6 52 09 14 38', 'atelier@chauffage-mensah.example', ['villa-rdc']),
  make('Serrurerie Gbaguidi', 'Théo Gbaguidi', 'artisan', 'serrurier', '+33 6 70 25 48 91', 'urgence@serrurerie-gbaguidi.example', ['apt-a1', 'apt-b3']),
  make('Menuiserie Tossou', 'Anne Tossou', 'artisan', 'menuisier', '+33 6 44 81 07 62', 'devis@menuiserie-tossou.example', ['residence-du-parc']),
  make('Toiture Dossa', 'Bruno Dossa', 'artisan', 'couvreur', '+33 6 19 60 33 85', 'contact@toiture-dossa.example', ['villa-rdc']),
  make('Nettoyage Aholou', 'Rose Aholou', 'artisan', 'entretien', '+33 6 28 74 15 06', 'planning@nettoyage-aholou.example', ['residence-du-parc', 'les-tilleuls']),
  make('Jardins Kakpo', 'Luc Kakpo', 'artisan', 'paysagiste', '+33 6 91 37 20 54', 'bonjour@jardins-kakpo.example', ['villa-rdc']),
  make('Syndic Horizon', 'Accueil copropriétaires', 'syndic', '', '+33 1 47 20 66 13', 'accueil@syndic-horizon.example', ['residence-du-parc']),
  make('Gestion Immo Plus', 'Pôle comptabilité', 'syndic', '', '+33 1 42 88 05 71', 'compta@gestion-immo-plus.example', ['les-tilleuls']),
  make('AssurHabitat', 'Contrat multirisque 51-902', 'assureur', '', '+33 5 57 12 40 66', 'sinistres@assurhabitat.example', ['residence-du-parc']),
  make('Groupe Sécurité Foyer', 'Contrat loyers impayés', 'assureur', '', '+33 1 55 31 70 09', 'gestion@securite-foyer.example', ['apt-a1', 'apt-b3']),
  make('Courtage Delmas', 'Courtier, Marie Delmas', 'assureur', '', '+33 4 72 18 33 52', 'contact@courtage-delmas.example', []),
  make('Joseph Dossou', 'Garant de Marc Dossou', 'garant', '', '+33 6 14 27 90 03', 'joseph.dossou@example.com', ['villa-rdc']),
  make('Clémence Roux', 'Garante de Léa Martin', 'garant', '', '+33 6 83 50 21 47', 'clemence.roux@example.com', ['apt-b3']),
  make('Raphaël Yao', 'Garant d’Ibrahim Yao', 'garant', '', '+33 6 05 92 38 16', 'raphael.yao@example.com', ['residence-du-parc']),
  make('Sandrine Hounkpatin', 'Garante de Clarisse Hounkpatin', 'garant', '', '+33 6 72 40 85 29', 'sandrine.hounkpatin@example.com', ['residence-du-parc']),
  make('Fabrice Sossou', 'Garant de Nadège Sossou', 'garant', '', '+33 6 38 16 04 77', 'fabrice.sossou@example.com', ['les-tilleuls']),
  make('Odile Agbo', 'Garante de Paulin Agbo', 'garant', '', '+33 6 60 71 29 54', 'odile.agbo@example.com', ['apt-b3']),
  make('Cyrille Zinsou', 'Garant de Mireille Zinsou', 'garant', '', '+33 6 25 93 60 18', 'cyrille.zinsou@example.com', ['apt-a1']),
  make('Peinture Azonhou', 'Ancien prestataire', 'artisan', 'peintre', '+33 6 11 22 33 44', 'contact@peinture-azonhou.example', [], false, true),
  make('Assurances Bocco', 'Ancien contrat PNO', 'assureur', '', '+33 5 55 20 14 90', 'accueil@assurances-bocco.example', [], false, true),
];

export function createDemoContactsSource(): ContactsSource {
  const items = createCollection(demoContacts);
  return {
    list: () => items.list(),
    create: async (draft) => {
      const input = contactInputSchema.parse(draft);
      const existing = (await items.list()).map((item) => item.id);
      return items.add({ ...input, id: uniqueSlug(input.name, existing, 'contact'), archived: false });
    },
    setShared: (id, shared) => items.update(id, { shared }),
    setArchived: (id, archived) => items.update(id, { archived }),
    remove: (id) => items.remove(id),
  };
}
