import { z } from 'zod';

export const isoCurrency = z.string().regex(/^[A-Z]{3}$/);
