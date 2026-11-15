import { describe, expect, it } from 'vitest';
import { BiensError } from '../errors';
import { documentsSchema } from '../schemas/common';
import { equipementDetailSchema, equipementIntervSchema, equipementsSchema } from '../schemas/equipements';
import {
  chargesSchema,
  coproSchema,
  immeubleDetailSchema,
  immeubleIntervSchema,
  immeublesSchema,
} from '../schemas/immeubles';
import {
  diagnosticsSchema,
  leaseSchema,
  lotDetailSchema,
  lotFinancesSchema,
  lotSuiviSchema,
  lotsSchema,
  occupationSchema,
} from '../schemas/lots';
import type { LotValues } from '../schemas/lots';
import { inventairesSchema, readingsSchema } from '../schemas/releves';
import { createDemoBiensSource } from './store';

const source = () => createDemoBiensSource({ latencyMs: 0 });

const newLot: LotValues = {
  name: 'Apt E5',
  type: 'appartement',
  immeubleId: 'les-tilleuls',
  address: '12 rue des Lilas',
  complement: '',
  postalCode: '75011',
  city: 'Paris',
  surface: 48.5,
  rooms: 2,
  floor: '4e',
  elevator: true,
  heating: 'electrique',
  amenities: ['balcon'],
  rent: 72000,
  charges: 8000,
  photoNames: [],
};

describe('données de démonstration des biens', () => {
  it('respectent les contrats pour chaque bien, immeuble et équipement', async () => {
    const demo = source();
    const lots = lotsSchema.parse(await demo.lots());
    expect(lots.items.length).toBeGreaterThan(10);
    for (const { id } of lots.items) {
      expect(lotDetailSchema.parse(await demo.lot(id))).not.toBeNull();
      occupationSchema.parse(await demo.lotOccupation(id));
      leaseSchema.parse(await demo.lotLease(id));
      diagnosticsSchema.parse(await demo.lotDiagnostics(id));
      lotSuiviSchema.parse(await demo.lotSuivi(id));
      lotFinancesSchema.parse(await demo.lotFinances(id));
      documentsSchema.parse(await demo.documents({ kind: 'lot', id }));
    }
    const immeubles = immeublesSchema.parse(await demo.immeubles());
    for (const { id } of immeubles.items) {
      expect(immeubleDetailSchema.parse(await demo.immeuble(id))).not.toBeNull();
      chargesSchema.parse(await demo.immeubleCharges(id));
      coproSchema.nullable().parse(await demo.immeubleCopro(id));
      immeubleIntervSchema.parse(await demo.immeubleInterventions(id));
      documentsSchema.parse(await demo.documents({ kind: 'immeuble', id }));
    }
    const equipements = equipementsSchema.parse(await demo.equipements());
    for (const { id } of equipements.items) {
      expect(equipementDetailSchema.parse(await demo.equipement(id))).not.toBeNull();
      equipementIntervSchema.parse(await demo.equipementInterventions(id));
      documentsSchema.parse(await demo.documents({ kind: 'equipement', id }));
    }
    readingsSchema.parse(await demo.readings());
    inventairesSchema.parse(await demo.inventaires());
  });

  it('renvoie null pour un bien inconnu et refuse ses sous-ressources', async () => {
    const demo = source();
    expect(lotDetailSchema.parse(await demo.lot('inconnu'))).toBeNull();
    await expect(demo.lotOccupation('inconnu')).rejects.toBeInstanceOf(BiensError);
    await expect(demo.immeubleCharges('inconnu')).rejects.toBeInstanceOf(BiensError);
    await expect(demo.equipementInterventions('inconnu')).rejects.toBeInstanceOf(BiensError);
  });

  it('calcule les compteurs de la fiche à partir des données', async () => {
    const detail = lotDetailSchema.parse(await source().lot('apt-a1'));
    expect(detail?.counts.equipements).toBe(6);
    expect(detail?.counts.locations).toBe(3);
    expect(detail?.lot.rent).toBe(85000);
  });
});

describe('biens', () => {
  it('crée un bien, le retrouve dans la liste et refuse un doublon', async () => {
    const demo = source();
    const { id } = await demo.createLot(newLot);
    expect(id).toBe('apt-e5');
    const lots = lotsSchema.parse(await demo.lots());
    const created = lots.items.find((item) => item.id === id);
    expect(created).toMatchObject({ name: 'Apt E5', rent: 80000, status: 'a_louer', immeubleName: 'Les Tilleuls' });
    await expect(demo.createLot(newLot)).rejects.toThrow('existe déjà');
  });

  it('refuse un bien dans un immeuble inconnu', async () => {
    await expect(source().createLot({ ...newLot, immeubleId: 'nulle-part' })).rejects.toThrow('Immeuble introuvable');
  });

  it('modifie un bien et répercute le nom partout', async () => {
    const demo = source();
    await demo.updateLot('apt-a2', { ...newLot, name: 'Apt A2 bis', rent: 100000, charges: 0 });
    const detail = lotDetailSchema.parse(await demo.lot('apt-a2'));
    expect(detail?.lot.name).toBe('Apt A2 bis');
    expect(detail?.lot.rent).toBe(100000);
    const equipements = equipementsSchema.parse(await demo.equipements());
    expect(equipements.items.find((item) => item.id === 'lave-vaisselle')?.placeName).toBe('Apt A2 bis');
  });

  it('archive en lot et refuse d’archiver un bien loué', async () => {
    const demo = source();
    await expect(demo.setLotsArchived(['apt-a1'], true)).rejects.toThrow('est loué');
    await demo.setLotsArchived(['bureau-b1'], false);
    const lots = lotsSchema.parse(await demo.lots());
    expect(lots.items.find((item) => item.id === 'bureau-b1')?.archived).toBe(false);
  });

  it('refuse de supprimer un bien loué, supprime un bien libre', async () => {
    const demo = source();
    await expect(demo.deleteLot('apt-a1')).rejects.toThrow('Suppression impossible');
    const { id } = await demo.createLot(newLot);
    await demo.deleteLot(id);
    const lots = lotsSchema.parse(await demo.lots());
    expect(lots.items.some((item) => item.id === id)).toBe(false);
  });

  it('duplique un bien vacant sans locataire', async () => {
    const demo = source();
    const { id } = await demo.duplicateLot('apt-a1');
    const detail = lotDetailSchema.parse(await demo.lot(id));
    expect(detail?.lot).toMatchObject({ name: 'Apt A1 (copie)', tenant: null, status: 'a_louer' });
  });

  it('met un bien en ligne et refuse un bien archivé', async () => {
    const demo = source();
    await demo.setLotListing('apt-a2', 'en_ligne');
    const lots = lotsSchema.parse(await demo.lots());
    expect(lots.items.find((item) => item.id === 'apt-a2')?.listing).toBe('en_ligne');
    await expect(demo.setLotListing('cave-c1', 'en_ligne')).rejects.toThrow('archivé');
  });

  it('importe des biens de façon atomique', async () => {
    const demo = source();
    const row = { name: 'Box 9', immeubleName: 'les tilleuls', type: 'garage' as const, surface: 11, rooms: null, rent: 5000 };
    await expect(demo.importLots([row, { ...row, name: 'Box 10', immeubleName: 'Inconnu' }])).rejects.toThrow('Ligne 2');
    expect(lotsSchema.parse(await demo.lots()).items.some((item) => item.name === 'Box 9')).toBe(false);
    await expect(demo.importLots([row])).resolves.toEqual({ created: 1 });
    await expect(demo.importLots([row])).rejects.toThrow('existe déjà');
  });

  it('enregistre un diagnostic et commande ceux à refaire', async () => {
    const demo = source();
    await demo.addDiagnostic('apt-a2', { label: 'Gaz', doneOn: '2026-11-01', validity: '6 ans', result: 'Conforme' });
    const created = diagnosticsSchema.parse(await demo.lotDiagnostics('apt-a2'));
    expect(created.items[0]).toMatchObject({ label: 'Gaz', status: 'valide', expiresOn: '2032-10-31' });
    await expect(demo.addDiagnostic('apt-a2', { label: 'Gaz', doneOn: '2027-01-01', validity: '6 ans', result: '' })).rejects.toThrow('futur');
    await demo.orderDiagnostics('apt-a1', ['electricite']);
    const ordered = diagnosticsSchema.parse(await demo.lotDiagnostics('apt-a1'));
    expect(ordered.items.find((item) => item.id === 'electricite')?.orderedOn).toBe('2026-11-13');
    await expect(demo.orderDiagnostics('apt-a1', ['dpe'])).rejects.toThrow('pas besoin');
  });
});

describe('immeubles', () => {
  it('crée, modifie et archive un immeuble', async () => {
    const demo = source();
    const values = { name: 'Villa Soleil', address: '5 rue du Port', postalCode: '13001', city: 'Marseille', country: 'France', repartition: 'surface' as const, photoNames: [] };
    const { id } = await demo.createImmeuble(values);
    await demo.updateImmeuble(id, { ...values, city: 'Aix' });
    const detail = immeubleDetailSchema.parse(await demo.immeuble(id));
    expect(detail?.immeuble.city).toBe('Aix');
    await demo.setImmeubleArchived(id, true);
    await demo.deleteImmeuble(id);
    expect(immeublesSchema.parse(await demo.immeubles()).items.some((item) => item.id === id)).toBe(false);
  });

  it('refuse un nom en doublon, l’archivage et la suppression d’un immeuble occupé', async () => {
    const demo = source();
    const values = { name: 'les tilleuls', address: 'x', postalCode: '1', city: 'y', country: 'z', repartition: 'surface' as const, photoNames: [] };
    await expect(demo.createImmeuble(values)).rejects.toThrow('existe déjà');
    await expect(demo.setImmeubleArchived('les-tilleuls', true)).rejects.toThrow('actifs');
    await expect(demo.deleteImmeuble('les-tilleuls')).rejects.toThrow('Suppression impossible');
  });
});

describe('équipements', () => {
  const values = {
    name: 'Sèche-linge',
    detail: '7 kg',
    family: 'electromenager' as const,
    lotId: 'apt-a2',
    immeubleId: null,
    room: 'Cellier',
    brand: 'Bosch',
    model: '',
    purchasedOn: '2026-01-10',
    price: 59900,
    warrantyEndsOn: '2028-01-10',
    chargedTo: 'bailleur' as const,
    photoNames: ['photo-lave-vaisselle.jpg'],
  };

  it('crée un équipement rattaché au bien et à son immeuble', async () => {
    const demo = source();
    const { id } = await demo.createEquipement(values);
    const detail = equipementDetailSchema.parse(await demo.equipement(id));
    expect(detail?.equipement).toMatchObject({ lotId: 'apt-a2', immeubleId: 'les-tilleuls', placeName: 'Apt A2' });
    expect(detail?.photoCount).toBe(1);
    expect(detail?.photos.map((photo) => photo.label)).toEqual(['photo-lave-vaisselle.jpg']);
    await expect(demo.createEquipement({ ...values, lotId: null })).rejects.toThrow('Choisissez');
    await expect(demo.createEquipement({ ...values, warrantyEndsOn: '2025-01-01' })).rejects.toThrow('garantie');
  });

  it('ajoute une entrée au carnet et une opération au plan', async () => {
    const demo = source();
    await demo.addLogEntry('climatiseur-reversible', { title: 'Recharge de gaz', date: '2026-11-10', detail: 'Clim Services 75', cost: 12000 });
    await demo.addOperation('climatiseur-reversible', { label: 'Contrôle des fixations', doneBy: 'Clim Services 75', periodicityMonths: 6, lastOn: '2026-11-10' });
    const detail = equipementDetailSchema.parse(await demo.equipement('climatiseur-reversible'));
    expect(detail?.log.find((entry) => entry.title === 'Recharge de gaz')).toMatchObject({ title: 'Recharge de gaz', done: true, cost: 12000 });
    expect(detail?.plan.at(-1)).toMatchObject({ nextOn: '2027-05-10', periodicity: 'Tous les 6 mois' });
    await expect(demo.addOperation('climatiseur-reversible', { label: 'x', doneBy: '', periodicityMonths: 0, lastOn: null })).rejects.toThrow('périodicité');
  });

  it('archive et supprime un équipement avec ses documents', async () => {
    const demo = source();
    await demo.deleteEquipement('climatiseur-reversible');
    expect(equipementsSchema.parse(await demo.equipements()).items.some((item) => item.id === 'climatiseur-reversible')).toBe(false);
    expect(documentsSchema.parse(await demo.documents({ kind: 'equipement', id: 'climatiseur-reversible' })).items).toHaveLength(0);
    await expect(demo.deleteEquipement('climatiseur-reversible')).rejects.toThrow('introuvable');
  });
});

describe('documents', () => {
  const input = { name: 'Quittance.pdf', category: 'Bail', shared: false, sizeBytes: 2048 };

  it('ajoute, partage puis supprime un document', async () => {
    const demo = source();
    await demo.addDocument({ kind: 'lot', id: 'apt-a2' }, input);
    const added = documentsSchema.parse(await demo.documents({ kind: 'lot', id: 'apt-a2' }));
    const document = added.items.find((item) => item.name === 'Quittance.pdf');
    expect(document).toMatchObject({ date: '2026-11-13', shared: false });
    if (!document) throw new Error('document manquant');
    await demo.setDocumentShared(document.id, true);
    await demo.deleteDocument(document.id);
    const after = documentsSchema.parse(await demo.documents({ kind: 'lot', id: 'apt-a2' }));
    expect(after.items.some((item) => item.id === document.id)).toBe(false);
  });

  it('refuse un fichier trop lourd, vide ou une catégorie inconnue', async () => {
    const demo = source();
    const owner = { kind: 'lot' as const, id: 'apt-a2' };
    await expect(demo.addDocument(owner, { ...input, sizeBytes: 11 * 1024 * 1024 })).rejects.toThrow('volumineux');
    await expect(demo.addDocument(owner, { ...input, sizeBytes: 0 })).rejects.toThrow('vide');
    await expect(demo.addDocument(owner, { ...input, category: 'Inconnue' })).rejects.toThrow('Catégorie');
    await expect(demo.addDocument({ kind: 'lot', id: 'nulle-part' }, input)).rejects.toThrow('introuvable');
  });
});

describe('relevés et inventaires', () => {
  it('enregistre un relevé avec sa consommation et son coût', async () => {
    const demo = source();
    const before = readingsSchema.parse(await demo.readings());
    const last = before.items.find((item) => item.meterId === 'apt-a1-electricite');
    expect(last?.index).toBeGreaterThan(0);
    const index = (last?.index ?? 0) + 100;
    await demo.createReading({ meterId: 'apt-a1-electricite', date: '2026-11-12', index, reason: 'en_cours_de_bail', origin: 'Relevé du locataire', hasPhoto: false });
    const after = readingsSchema.parse(await demo.readings());
    expect(after.items.find((item) => item.date === '2026-11-12')).toMatchObject({ delta: 100, cost: 2516, enteredBy: 'Vous' });
  });

  it('refuse un index inférieur au précédent, une date future et un doublon', async () => {
    const demo = source();
    const base = { meterId: 'apt-a1-electricite', reason: 'en_cours_de_bail' as const, origin: 'Relevé du locataire', hasPhoto: false };
    await expect(demo.createReading({ ...base, date: '2026-11-12', index: 10 })).rejects.toThrow('précédent');
    await expect(demo.createReading({ ...base, date: '2027-01-01', index: 99999 })).rejects.toThrow('futur');
    await expect(demo.createReading({ ...base, date: '2026-11-01', index: 99999 })).rejects.toThrow('existe déjà');
    await expect(demo.createReading({ ...base, meterId: 'inconnu', date: '2026-11-12', index: 1 })).rejects.toThrow('Compteur');
  });

  it('corrige un relevé en recalculant sa consommation, ou le laisse intact si la correction est refusée', async () => {
    const demo = source();
    const items = readingsSchema.parse(await demo.readings()).items.filter((item) => item.meterId === 'apt-a1-electricite');
    const [latest, previous] = items;
    if (!latest || !previous) throw new Error('relevés absents');
    const input = { meterId: latest.meterId, date: latest.date, index: previous.index + 50, reason: latest.reason, origin: latest.origin, hasPhoto: false };
    await demo.updateReading(latest.id, input);
    const updated = readingsSchema.parse(await demo.readings()).items.find((item) => item.id === latest.id);
    expect(updated).toMatchObject({ index: previous.index + 50, delta: 50, enteredBy: latest.enteredBy });
    await expect(demo.updateReading(latest.id, { ...input, index: previous.index - 1 })).rejects.toThrow('précédent');
    expect(readingsSchema.parse(await demo.readings()).items.find((item) => item.id === latest.id)?.index).toBe(previous.index + 50);
    await expect(demo.updateReading('inconnu', input)).rejects.toThrow('introuvable');
  });

  it('joint une photo à un relevé', async () => {
    const demo = source();
    const bare = readingsSchema.parse(await demo.readings()).items.find((item) => !item.hasPhoto);
    if (!bare) throw new Error('relevé sans photo absent');
    await demo.attachReadingPhoto(bare.id);
    expect(readingsSchema.parse(await demo.readings()).items.find((item) => item.id === bare.id)?.hasPhoto).toBe(true);
  });

  it('archive et supprime un relevé', async () => {
    const demo = source();
    const [first] = readingsSchema.parse(await demo.readings()).items;
    if (!first) throw new Error('aucun relevé');
    await demo.setReadingArchived(first.id, true);
    expect(readingsSchema.parse(await demo.readings()).items.find((item) => item.id === first.id)?.archived).toBe(true);
    await demo.deleteReading(first.id);
    await expect(demo.deleteReading(first.id)).rejects.toThrow('introuvable');
  });

  it('crée et duplique un inventaire avec une référence continue', async () => {
    const demo = source();
    const { id } = await demo.createInventaire({ lotId: 'apt-a2', template: 'Vide, standard', tenant: null, value: 150000 });
    const copy = await demo.duplicateInventaire(id);
    const items = inventairesSchema.parse(await demo.inventaires()).items;
    expect(items.find((item) => item.id === id)).toMatchObject({ ref: 'INV-2026-0007', tenant: 'Nadège Sossou', lotName: 'Apt A2' });
    expect(items.find((item) => item.id === copy.id)?.ref).toBe('INV-2026-0008');
    await demo.setInventaireArchived(id, true);
    await demo.deleteInventaire(copy.id);
    await expect(demo.deleteInventaire(copy.id)).rejects.toThrow('introuvable');
    await expect(demo.createInventaire({ lotId: 'apt-a2', template: 'Inconnu', tenant: null, value: 1 })).rejects.toThrow('Modèle');
  });

  it('modifie un inventaire et envoie la demande de signature au locataire', async () => {
    const demo = source();
    await demo.updateInventaire('inv-2026-0006', { lotId: 'lot-b3', template: 'Meublé, studio', tenant: null, value: 510000 });
    await demo.requestInventaireSignature('inv-2026-0006');
    const item = inventairesSchema.parse(await demo.inventaires()).items.find((entry) => entry.id === 'inv-2026-0006');
    expect(item).toMatchObject({ template: 'Meublé, studio', value: 510000, tenant: 'Yann Le Gall', signatureSentOn: '2026-11-13' });
    await demo.updateInventaire('inv-2026-0006', { lotId: 'lot-b3', template: 'Meublé, studio', tenant: 'Léa Martin', value: 510000 });
    expect(inventairesSchema.parse(await demo.inventaires()).items.find((entry) => entry.id === 'inv-2026-0006')?.signatureSentOn).toBeNull();
    await expect(demo.updateInventaire('inv-2026-0006', { lotId: 'lot-b3', template: 'Inconnu', tenant: null, value: 1 })).rejects.toThrow('Modèle');
    await expect(demo.updateInventaire('inconnu', { lotId: 'lot-b3', template: 'Meublé, studio', tenant: null, value: 1 })).rejects.toThrow('introuvable');
  });

  it('refuse d’envoyer pour signature un inventaire sans locataire', async () => {
    const demo = source();
    await expect(demo.requestInventaireSignature('inv-2026-0003')).rejects.toThrow('Aucun locataire');
  });
});
