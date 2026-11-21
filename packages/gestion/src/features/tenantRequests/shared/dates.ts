import { z } from 'zod';

export const MIN_DATE = '2000-01-01';

export const requiredDate = (label: string) => z.iso.date(`${label} : indiquez une date valide.`).refine((value) => value >= MIN_DATE, `${label} : la date est trop ancienne.`);
