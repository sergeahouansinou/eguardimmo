"use client";

import { Alert } from "@eguardimmo/ui";
import type { AlertProps } from "@eguardimmo/ui";
import { useEffect, useRef } from "react";

export function FormAlert({ focusOnMount = false, ...props }: AlertProps & { focusOnMount?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return <Alert {...props} ref={ref} tabIndex={-1} className="text-left outline-none focus-visible:outline-2 focus-visible:outline-focus" />;
}
