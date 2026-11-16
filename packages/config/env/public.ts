import { z } from 'zod';

const DATA_SOURCES = ['demo', 'api'] as const;

const DATA_SOURCE_REQUIRED = 'NEXT_PUBLIC_DATA_SOURCE est obligatoire en production : renseigner explicitement demo ou api.';
const DATA_SOURCE_INVALID = 'NEXT_PUBLIC_DATA_SOURCE doit valoir demo ou api.';

// Variables publiques uniquement : tout NEXT_PUBLIC_* est visible dans le bundle.
export function createPublicEnvSchema(nodeEnv: string | undefined) {
  const production = nodeEnv === 'production';
  const dataSource = z.enum(DATA_SOURCES, {
    error: (issue) => (issue.input === undefined ? DATA_SOURCE_REQUIRED : DATA_SOURCE_INVALID),
  });
  return z.object({
    NEXT_PUBLIC_API_URL: z.url(),
    NEXT_PUBLIC_DATA_SOURCE: production ? dataSource : dataSource.default('demo'),
    NEXT_PUBLIC_AUTH_URL: z.url().optional(),
  });
}

export const publicEnvSchema = createPublicEnvSchema(process.env.NODE_ENV);

export type PublicEnv = z.infer<typeof publicEnvSchema>;
