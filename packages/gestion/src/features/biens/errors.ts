export type BiensErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'stale_version'
  | 'conflict'
  | 'invalid'
  | 'unreachable'
  | 'unexpected_response'
  | 'no_organization'
  | 'unsupported'
  | 'demo';

export interface BiensErrorOptions {
  kind?: BiensErrorKind;
  status?: number;
  code?: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  cause?: unknown;
}

export class BiensError extends Error {
  readonly kind: BiensErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(message: string, options: BiensErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'BiensError';
    this.kind = options.kind ?? 'demo';
    this.status = options.status ?? null;
    this.code = options.code ?? this.kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const STALE_VERSION_MESSAGE = 'Ce bien a été modifié entre-temps. Rechargez la page pour voir sa dernière version, puis refaites vos changements.';

export class BiensStaleVersionError extends BiensError {
  constructor(cause?: unknown) {
    super(STALE_VERSION_MESSAGE, { kind: 'stale_version', status: 409, code: 'version_conflict', cause });
    this.name = 'BiensStaleVersionError';
  }
}

export const isStaleVersion = (error: unknown): error is BiensError => error instanceof BiensError && error.kind === 'stale_version';
