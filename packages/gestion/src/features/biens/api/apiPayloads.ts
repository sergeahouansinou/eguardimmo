import type { Body } from '@eguardimmo/api';
import { countryCode } from '../lib/country';
import type { ImmeubleValues } from '../schemas/immeubles';
import type { LotValues } from '../schemas/lots';
import { invalid } from './apiErrors';
import { OWNERSHIP_NATURES, serverIdSchema } from './apiSchemas';
import type { ApiProperty, ApiUnit } from './apiSchemas';

const INTEGER_TEXT = /^-?\d+$/;
const MIN_FLOOR = -20;
const MAX_FLOOR = 300;
const RESIDENTIAL = 'residential';

export interface TypeChoice {
  id: string;
  semantic: string | null;
}

export const isServerId = (value: string): boolean => serverIdSchema.safeParse(value).success;

export function requireServerId(value: string, what: string): string {
  if (!isServerId(value)) throw invalid(`${what} : identifiant invalide. Rechargez la page.`, 'invalid_identifier');
  return value;
}

function addressOf(values: ImmeubleValues, line2: string | null) {
  const country = countryCode(values.country);
  if (country === null) throw invalid(`Pays inconnu : « ${values.country} ». Indiquez un pays, ex. France ou FR.`);
  return { line1: values.address.trim(), line2, postal_code: values.postalCode.trim(), city: values.city.trim(), country };
}

export function createPropertyPayload(values: ImmeubleValues): Body {
  return { name: values.name.trim(), type: values.siteType ?? 'building', address: addressOf(values, null) };
}

export function updatePropertyPayload(current: ApiProperty, values: ImmeubleValues): Body {
  return {
    lock_version: current.lock_version,
    name: values.name.trim(),
    type: values.siteType ?? current.type,
    address: addressOf(values, current.address.line2 ?? null),
  };
}

export function floorOf(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const floor = INTEGER_TEXT.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (!Number.isInteger(floor) || floor < MIN_FLOOR || floor > MAX_FLOOR) throw invalid(`Étage : indiquez un nombre entier entre ${String(MIN_FLOOR)} et ${String(MAX_FLOOR)}, ex. 3 ou -1.`);
  return floor;
}

export function hundredthsOf(surface: number | null): number | null {
  if (surface === null) return null;
  const hundredths = Math.round(surface * 100);
  if (!Number.isSafeInteger(hundredths) || hundredths < 1) throw invalid('Surface invalide : indiquez une surface positive en m².');
  return hundredths;
}

function residentialCharacteristics(values: LotValues, base: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...base, rooms: values.rooms, has_elevator: values.elevator };
}

function characteristicsFor(values: LotValues, type: TypeChoice, current: Readonly<Record<string, unknown>>, sameSemantic: boolean): Record<string, unknown> {
  if (type.semantic === RESIDENTIAL) return residentialCharacteristics(values, sameSemantic ? current : {});
  if (values.rooms !== null || values.elevator) throw invalid('Le nombre de pièces et l’ascenseur ne concernent que les logements.');
  return sameSemantic ? { ...current } : {};
}

export function createUnitPayload(values: LotValues, type: TypeChoice): Body {
  const characteristics = characteristicsFor(values, type, {}, false);
  const present = Object.fromEntries(Object.entries(characteristics).filter(([, value]) => value !== null));
  return {
    property_id: requireServerId(values.immeubleId, 'Immeuble'),
    unit_type_term_id: type.id,
    reference: values.name.trim(),
    floor: floorOf(values.floor),
    surface_hundredths: hundredthsOf(values.surface),
    characteristics: present,
  };
}

export function updateUnitPayload(current: ApiUnit, values: LotValues, type: TypeChoice): Body {
  if (values.immeubleId !== current.property.id) throw invalid('Un lot ne change pas d’immeuble : créez-le dans le bon immeuble.', 'unit_property_fixed');
  const sameSemantic = (current.unit_type.semantic_key ?? null) === type.semantic;
  return {
    lock_version: current.lock_version,
    unit_type_term_id: type.id,
    reference: values.name.trim(),
    floor: floorOf(values.floor),
    surface_hundredths: hundredthsOf(values.surface),
    characteristics: characteristicsFor(values, type, current.characteristics, sameSemantic),
  };
}

export interface OwnershipInput {
  partyId: string;
  shareBp: number;
  nature: (typeof OWNERSHIP_NATURES)[number];
  validFrom: string;
  validTo: string | null;
}

export function ownershipPayload(input: OwnershipInput): Body {
  if (!Number.isInteger(input.shareBp) || input.shareBp < 1 || input.shareBp > 10000) throw invalid('Quote-part invalide : indiquez un entier entre 1 et 10 000 (en points de base, 10 000 = 100 %).');
  return {
    party_id: requireServerId(input.partyId, 'Propriétaire'),
    share_bp: input.shareBp,
    nature: input.nature,
    valid_from: input.validFrom,
    ...(input.validTo === null ? {} : { valid_to: input.validTo }),
  };
}
