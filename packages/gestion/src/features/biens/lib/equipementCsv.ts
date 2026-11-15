import type { Currency } from '../../../format/money';
import { toMajorInput } from './amount';
import { formatDate } from './dates';
import { toCsv } from './files';
import { CHARGED_LABELS, FAMILY_LABELS } from './labels';
import type { EquipementRow } from '../schemas/equipements';

export function equipementsToCsv(rows: readonly EquipementRow[], currency: Currency): string {
  const header = ['Équipement', 'Détail', 'Famille', 'Bien', 'Date d’achat', 'Prix', 'Fin de garantie', 'Prochain entretien', 'À la charge de', 'État', 'Archivé'];
  const lines = rows.map((row) => [
    row.name,
    row.detail,
    FAMILY_LABELS[row.family],
    row.placeName,
    row.purchasedOn ? formatDate(row.purchasedOn) : '',
    row.price === null ? '' : toMajorInput(row.price, currency),
    row.warrantyEndsOn ? formatDate(row.warrantyEndsOn) : '',
    row.nextMaintenanceOn ? formatDate(row.nextMaintenanceOn) : '',
    CHARGED_LABELS[row.chargedTo],
    row.status === 'en_service' ? 'En service' : 'Hors service',
    row.archived ? 'Oui' : 'Non',
  ]);
  return toCsv([header, ...lines]);
}
