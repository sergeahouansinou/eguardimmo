import { z } from 'zod';

// Variables publiques uniquement : tout NEXT_PUBLIC_* est visible dans le bundle.
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_DATA_SOURCE: z.enum(['demo', 'api']).default('demo'),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
