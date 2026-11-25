import { providerSchema } from "@/features/auth/schemas";
import type { SocialProvider } from "@/features/auth/schemas";

const STORAGE_KEY = "eguardimmo.auth.social-provider";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberSocialProvider(provider: SocialProvider): void {
  try {
    storage()?.setItem(STORAGE_KEY, provider);
  } catch {
    return;
  }
}

export function readSocialProvider(): SocialProvider | null {
  try {
    const parsed = providerSchema.safeParse(storage()?.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
