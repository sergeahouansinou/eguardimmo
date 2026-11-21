import { z } from 'zod';

export const limitInputSchema = z.string().trim().regex(/^\d{1,9}$/);
