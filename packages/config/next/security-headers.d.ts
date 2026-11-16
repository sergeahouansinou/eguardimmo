export interface SecurityHeader {
  key: string;
  value: string;
}

export interface HeaderRule {
  source: string;
  headers: SecurityHeader[];
}

export declare const securityHeaders: SecurityHeader[];

export declare function contentSecurityPolicy(overrides?: Record<string, string[]>): string;

export declare function createSecurityHeaders(policy: string): SecurityHeader[];

export declare function securityHeadersWithPolicy(policy: string): () => Promise<HeaderRule[]>;

export declare function securityHeadersForAllRoutes(): Promise<HeaderRule[]>;
