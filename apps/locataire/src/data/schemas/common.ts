import { z } from 'zod';

export const isoDate = z.iso.date();
export const isoDateTime = z.iso.datetime({ local: true });
export const cents = z.number().int();
export const centsPositive = cents.positive();
export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} est obligatoire.`).max(max, `${label} est trop long.`);
