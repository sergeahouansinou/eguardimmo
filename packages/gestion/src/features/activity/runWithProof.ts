import type { TwoFactorProof } from '../reauth';

export function runWithProof<T>(proof: TwoFactorProof, action: () => Promise<T>, abandoned: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const attempt = (): void => {
      action().then(resolve, (error: unknown) => {
        const failure = error instanceof Error ? error : new Error('Action impossible.');
        if (proof.intercept(error, attempt, () => { reject(new Error(abandoned)); })) return;
        reject(failure);
      });
    };
    attempt();
  });
}
