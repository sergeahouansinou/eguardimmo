export interface SecurityHeader {
  key: string;
  value: string;
}

export interface HeaderRule {
  source: string;
  headers: SecurityHeader[];
}

export interface AppPolicyOptions {
  development?: boolean;
  connectOrigins?: (string | undefined)[];
  frameSources?: string[];
}

export declare function contentSecurityPolicy(overrides?: Record<string, string[]>): string;

export declare function appContentSecurityPolicy(options?: AppPolicyOptions): string;

export declare function createSecurityHeaders(policy: string): SecurityHeader[];

export declare function securityHeadersForApp(options?: AppPolicyOptions): () => Promise<HeaderRule[]>;

export declare function securityHeadersWithPolicy(policy: string): () => Promise<HeaderRule[]>;
