export interface SecurityHeader {
  key: string;
  value: string;
}

export declare const securityHeaders: SecurityHeader[];

export declare function securityHeadersForAllRoutes(): Promise<
  { source: string; headers: SecurityHeader[] }[]
>;
