import { z } from 'zod';
import { BIEN_IDS } from '../shared/biens';

export const CATEGORIES = ['artisan', 'syndic', 'assureur', 'garant'] as const;
export type Category = (typeof CATEGORIES)[number];

export const categoryLabels: Record<Category, string> = {
  artisan: 'Artisan',
  syndic: 'Syndic',
  assureur: 'Assureur',
  garant: 'Garant',
};

export const categoryTabLabels: Record<Category, string> = {
  artisan: 'Artisans',
  syndic: 'Syndics',
  assureur: 'Assureurs',
  garant: 'Garants',
};

export const REACH_MESSAGE = 'Indiquez au moins un téléphone ou une adresse e-mail.';

const phoneDigits = (value: string): number => value.replace(/\D/g, '').length;

export const contactInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Indiquez le nom du contact.').max(120, 'Le nom ne dépasse pas 120 caractères.'),
    subtitle: z.string().trim().max(120, 'Ce champ ne dépasse pas 120 caractères.'),
    category: z.enum(CATEGORIES, { error: 'Choisissez une catégorie.' }),
    detail: z.string().trim().max(60, 'La précision ne dépasse pas 60 caractères.'),
    phone: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || (/^\+?[\d\s().-]+$/.test(value) && phoneDigits(value) >= 8 && phoneDigits(value) <= 15),
        'Indiquez un numéro valide, par exemple +33 6 12 40 18 77.',
      ),
    email: z
      .string()
      .trim()
      .max(254, 'L’adresse e-mail est trop longue.')
      .refine((value) => value === '' || z.email().safeParse(value).success, 'Indiquez une adresse e-mail valide, par exemple nom@exemple.fr.'),
    bienIds: z.array(z.enum(BIEN_IDS)),
    shared: z.boolean(),
  })
  .refine((value) => value.phone !== '' || value.email !== '', {
    path: ['phone'],
    message: REACH_MESSAGE,
  });
export type ContactInput = z.infer<typeof contactInputSchema>;

export const contactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string(),
  category: z.enum(CATEGORIES),
  detail: z.string(),
  phone: z.string(),
  email: z.string(),
  bienIds: z.array(z.enum(BIEN_IDS)),
  shared: z.boolean(),
  archived: z.boolean(),
});
export type Contact = z.infer<typeof contactSchema>;

export const contactListSchema = z.array(contactSchema);

export const categoryText = (contact: Pick<Contact, 'category' | 'detail'>): string =>
  contact.detail === '' ? categoryLabels[contact.category] : `${categoryLabels[contact.category]}, ${contact.detail}`;
