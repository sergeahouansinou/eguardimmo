"use client";

import { ErrorMessage } from "@/components/roost/SystemMessage";

export default function Error({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorMessage onRetry={unstable_retry} />;
}
