import { z } from 'zod';

const KEY_BYTES = 32;

const serverEnvSchema = z.object({
  CONSOLE_API_URL: z.url().transform((value) => value.replace(/\/+$/, '')),
  CONSOLE_SESSION_SECRET: z
    .base64()
    .transform((value) => Buffer.from(value, 'base64'))
    .refine((key) => key.length === KEY_BYTES, 'La clé de session doit faire 32 octets (base64).'),
  CONSOLE_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(240),
  CONSOLE_RELAY_KEY: z.string().min(32, 'La clé de relais doit faire au moins 32 caractères.'),
  CONSOLE_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(5).default(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv | null {
  const ttl = source.CONSOLE_TOKEN_TTL_MINUTES;
  const hops = source.CONSOLE_TRUSTED_PROXY_HOPS;
  const parsed = serverEnvSchema.safeParse({
    CONSOLE_API_URL: source.CONSOLE_API_URL,
    CONSOLE_SESSION_SECRET: source.CONSOLE_SESSION_SECRET,
    CONSOLE_TOKEN_TTL_MINUTES: ttl === '' ? undefined : ttl,
    CONSOLE_RELAY_KEY: source.CONSOLE_RELAY_KEY,
    CONSOLE_TRUSTED_PROXY_HOPS: hops === '' ? undefined : hops,
  });
  if (parsed.success) return parsed.data;
  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ');
  console.error(`[console] Configuration serveur invalide : ${fields}.`);
  return null;
}

export function readServerEnv(): ServerEnv | null {
  return parseServerEnv(process.env);
}
