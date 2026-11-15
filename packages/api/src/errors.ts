import { z } from 'zod';

const problemSchema = z.object({
  code: z.string().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string[]> = {}, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  firstFieldError(): string | null {
    const first = Object.values(this.fieldErrors)[0];
    return first?.[0] ?? null;
  }
}

export class ApiUnreachableError extends Error {
  constructor() {
    super('Le serveur est injoignable. Vérifiez votre connexion et réessayez.');
    this.name = 'ApiUnreachableError';
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: 'Votre session a expiré. Reconnectez-vous.',
  403: 'Vous n’avez pas accès à cette action.',
  404: 'Élément introuvable.',
  419: 'Votre session a expiré. Rechargez la page.',
  422: 'Certains champs sont invalides.',
  429: 'Trop de tentatives. Patientez avant de réessayer.',
};

export async function toApiError(response: Response): Promise<ApiError> {
  const payload: unknown = await response.json().catch(() => null);
  const parsed = problemSchema.safeParse(payload);
  const problem = parsed.success ? parsed.data : {};
  const retryHeader = Number(response.headers.get('Retry-After'));
  const message = problem.detail ?? problem.title ?? FALLBACK_MESSAGES[response.status] ?? 'Une erreur est survenue. Réessayez.';
  return new ApiError(
    response.status,
    problem.code ?? `http_${String(response.status)}`,
    message,
    problem.errors ?? {},
    Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : null,
  );
}
