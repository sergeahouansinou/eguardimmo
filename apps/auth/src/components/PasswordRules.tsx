import { Circle, CircleCheck } from "lucide-react";
import { Icon, ProgressBar, cx } from "@eguardimmo/ui";
import { checkPassword, passwordStrength } from "@/lib/password";

export function PasswordRules({ value, extraRule }: { value: string; extraRule?: string }) {
  const checks = checkPassword(value);
  const strength = passwordStrength(value);
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Règles du mot de passe" className="flex flex-col gap-1 text-caption text-fg-muted">
        {checks.map((check) => (
          <li key={check.id} className="flex items-center gap-1.5">
            <Icon icon={check.ok ? CircleCheck : Circle} size={14} className={cx(check.ok ? "text-success-fg" : "text-fg-subtle")} />
            <span>{check.label}</span>
            <span className="sr-only">{check.ok ? " : respectée" : " : à respecter"}</span>
          </li>
        ))}
        {extraRule ? (
          <li className="flex items-center gap-1.5">
            <Icon icon={Circle} size={14} className="text-fg-subtle" />
            <span>{extraRule}</span>
          </li>
        ) : null}
      </ul>
      <div className="flex flex-col gap-1">
        <ProgressBar value={strength.percent} label={`Robustesse du mot de passe : ${strength.label}`} />
        <p aria-live="polite" className="text-caption text-fg-subtle">
          Robustesse : {strength.label}
        </p>
      </div>
    </div>
  );
}
