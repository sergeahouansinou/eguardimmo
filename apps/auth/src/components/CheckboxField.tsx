"use client";

import { useId } from "react";
import { TERMS_LINK } from "@/lib/legal";
import type { ComponentProps, ReactNode } from "react";

export interface CheckboxFieldProps extends Omit<ComponentProps<"input">, "type" | "children"> {
  label: ReactNode;
  error?: string;
}

export function CheckboxField({ label, error, id, ...props }: CheckboxFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <input
          {...props}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-4 shrink-0 accent-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <label htmlFor={inputId} className="text-body text-fg-muted">
          {label}
        </label>
      </div>
      {error ? (
        <p id={errorId} className="text-caption text-fg-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TermsLabel({ verb = "J’accepte" }: { verb?: string }) {
  return (
    <>
      {verb} les{" "}
      {TERMS_LINK === null ? (
        "conditions d’utilisation"
      ) : (
        <a
          href={TERMS_LINK.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-action-on-subtle underline underline-offset-3"
        >
          conditions d’utilisation
        </a>
      )}
      .
    </>
  );
}
