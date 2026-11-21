import { z } from 'zod';
import { CURRENCIES } from '../../../format/money';

export const id = z.guid();
export const timestamp = z.iso.datetime({ offset: true });
export const isoDate = z.iso.date();
export const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });

const cursorMeta = z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() });

export const pageOf = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), meta: cursorMeta });
export const oneOf = <T extends z.ZodType>(item: T) => z.object({ data: item });
