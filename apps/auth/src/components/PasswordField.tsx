"use client";

import { Eye, EyeOff } from "lucide-react";
import { IconButton, cx } from "@eguardimmo/ui";
import { useId, useState } from "react";
import type { ComponentProps } from "react";

export interface PasswordFieldProps extends Omit<ComponentProps<"input">, "type" | "placeholder" | "autoComplete"> {
  label: string;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  error?: string;
}

export function PasswordField({ label, placeholder, autoComplete, hint, error, id, className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={inputId} className="text-caption text-fg-muted">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={inputId}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          className={cx(
            "h-8 w-full rounded-sm border border-line-control bg-surface pr-9 pl-2.5 text-body text-fg placeholder:text-fg-placeholder",
            "focus:border-focus focus:outline-2 focus:-outline-offset-1 focus:outline-focus",
            "disabled:cursor-not-allowed disabled:border-line disabled:bg-disabled disabled:text-fg-disabled",
            "aria-invalid:border-danger-solid",
            className,
          )}
        />
        <span className="absolute inset-y-0 right-0.5 flex items-center">
          <IconButton
            label="Afficher le mot de passe"
            icon={visible ? EyeOff : Eye}
            aria-pressed={visible}
            onClick={() => { setVisible((value) => !value); }}
          />
        </span>
      </div>
      {hint ? (
        <p id={hintId} className="text-caption font-normal text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption font-normal text-fg-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
