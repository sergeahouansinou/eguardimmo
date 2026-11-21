import { z } from 'zod';
import { CONTACT_KINDS, CONTACT_LANGUAGES, CONTACT_POINT_TYPES, MAX_CATEGORIES, MAX_CONTACT_POINTS, MAX_NOTE_LENGTH, MAX_TAGS } from './model';
import type { ContactAddress, ContactDetail, ContactInput, ContactFields } from './model';

const NO_ANGLE_BRACKETS = /^[^<>]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (label: string, max: number) => z.string().trim().max(max, `${label} : ${String(max)} caractères au plus.`).regex(NO_ANGLE_BRACKETS, `${label} : les caractères < et > ne sont pas autorisés.`);

const pointFields = {
  type: z.enum(CONTACT_POINT_TYPES),
  value: z.string().trim().min(1, 'Renseignez la coordonnée ou retirez la ligne.').max(254, '254 caractères au plus.'),
  label: text('Interlocuteur', 60),
};

function always<T>(run: (context: z.core.ParsePayload<T>) => void): z.core.$ZodCheck<T> {
  const check = z.check(run);
  check._zod.def.when = () => true;
  return check;
}

const checkEmail = <T extends { type: string; value: string }>() =>
  always<T>((context) => {
    if (context.value.type === 'email' && !EMAIL.test(context.value.value)) context.issues.push({ code: 'custom', message: 'Adresse e-mail invalide.', path: ['value'], input: context.value });
  });

const pointSchema = z.object(pointFields).check(checkEmail());

export const contactPointFormSchema = z.object({ ...pointFields, primary: z.boolean() }).check(checkEmail());
export type ContactPointFormValues = z.input<typeof contactPointFormSchema>;
export type ContactPointFormOutput = z.output<typeof contactPointFormSchema>;

const baseFormSchema = z.object({
  kind: z.enum(CONTACT_KINDS),
  lastName: text('Nom', 120),
  firstName: text('Prénom', 120),
  companyName: text('Raison sociale', 200),
  line1: text('Adresse', 200),
  line2: text('Complément', 200),
  postalCode: text('Code postal', 20),
  city: text('Ville', 100),
  country: z.string().trim().regex(/^([A-Z]{2})?$/, 'Code pays à deux lettres majuscules.'),
  language: z.enum(CONTACT_LANGUAGES),
  note: z.string().trim().max(MAX_NOTE_LENGTH, `La note ne peut pas dépasser ${String(MAX_NOTE_LENGTH)} caractères.`).regex(NO_ANGLE_BRACKETS, 'Les caractères < et > ne sont pas autorisés dans la note.'),
  categoryIds: z.array(z.string()).max(MAX_CATEGORIES, `${String(MAX_CATEGORIES)} catégories au plus.`),
  tagIds: z.array(z.string()).max(MAX_TAGS, `${String(MAX_TAGS)} étiquettes au plus.`),
  contactPoints: z.array(pointSchema).max(MAX_CONTACT_POINTS, `${String(MAX_CONTACT_POINTS)} coordonnées au plus.`),
});

export const contactFormSchema = baseFormSchema.check(
  always<z.output<typeof baseFormSchema>>((context) => {
    const value = context.value;
    const issue = (path: string, message: string) => context.issues.push({ code: 'custom', message, path: [path], input: value });
    if (value.kind === 'person' && value.lastName === '') issue('lastName', 'Renseignez le nom.');
    if (value.kind === 'company' && value.companyName === '') issue('companyName', 'Renseignez la raison sociale.');
    const address = [value.line1, value.postalCode, value.city];
    if ((address.some((part) => part !== '') || value.line2 !== '') && address.some((part) => part === '')) {
      if (value.line1 === '') issue('line1', 'Adresse incomplète : renseignez la rue, le code postal et la ville.');
      if (value.postalCode === '') issue('postalCode', 'Renseignez le code postal.');
      if (value.city === '') issue('city', 'Renseignez la ville.');
    }
  }),
);

export type ContactFormValues = z.input<typeof contactFormSchema>;
export type ContactFormOutput = z.output<typeof contactFormSchema>;

const blank = (value: string): string | null => (value.trim() === '' ? null : value.trim());

function addressOf(values: ContactFormOutput): ContactAddress | null {
  if (values.line1 === '') return null;
  return { line1: values.line1, line2: blank(values.line2), postalCode: values.postalCode, city: values.city, country: values.country === '' ? 'FR' : values.country };
}

export function toContactFields(values: ContactFormOutput): ContactFields {
  return {
    kind: values.kind,
    lastName: values.kind === 'person' ? blank(values.lastName) : null,
    firstName: values.kind === 'person' ? blank(values.firstName) : null,
    companyName: values.kind === 'company' ? blank(values.companyName) : null,
    address: addressOf(values),
    language: values.language,
    note: blank(values.note),
    categoryIds: values.categoryIds,
    tagIds: values.tagIds,
  };
}

export function toContactInput(values: ContactFormOutput): ContactInput {
  const seen = new Set<string>();
  return {
    ...toContactFields(values),
    contactPoints: values.contactPoints.map((point) => {
      const primary = !seen.has(point.type);
      seen.add(point.type);
      return { type: point.type, value: point.value, label: blank(point.label), primary };
    }),
  };
}

export const emptyContactValues = (): ContactFormValues => ({
  kind: 'person',
  lastName: '',
  firstName: '',
  companyName: '',
  line1: '',
  line2: '',
  postalCode: '',
  city: '',
  country: 'FR',
  language: 'fr',
  note: '',
  categoryIds: [],
  tagIds: [],
  contactPoints: [],
});

export const contactValuesOf = (contact: ContactDetail): ContactFormValues => ({
  ...emptyContactValues(),
  kind: contact.kind,
  lastName: contact.lastName ?? '',
  firstName: contact.firstName ?? '',
  companyName: contact.companyName ?? '',
  line1: contact.address?.line1 ?? '',
  line2: contact.address?.line2 ?? '',
  postalCode: contact.address?.postalCode ?? '',
  city: contact.address?.city ?? '',
  country: contact.address?.country ?? 'FR',
  language: CONTACT_LANGUAGES.find((language) => language === contact.language) ?? 'fr',
  note: contact.note ?? '',
  categoryIds: contact.categories.map((category) => category.id),
  tagIds: contact.tags.map((tag) => tag.id),
});
