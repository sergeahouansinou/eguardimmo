import { ProgressBar } from "@eguardimmo/ui";
import { passwordStrength } from "@/lib/password";

export function PasswordStrengthMeter({ value }: { value: string }) {
  const strength = passwordStrength(value);
  return (
    <div className="flex flex-col gap-1">
      <ProgressBar value={strength.percent} label={`Robustesse du mot de passe : ${strength.label}`} />
      <p aria-live="polite" className="text-caption text-fg-subtle">
        Robustesse : {strength.label}
      </p>
    </div>
  );
}
