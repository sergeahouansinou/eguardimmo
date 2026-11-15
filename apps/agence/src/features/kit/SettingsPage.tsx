import { Alert, Button, cx } from "@eguardimmo/ui";
import Link from "next/link";
import type { SubmitEventHandler, ReactNode } from "react";
import { PageFrame } from "./PageFrame";

interface SettingsSection {
  label: string;
  links: readonly { href: string; label: string }[];
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    label: "Agence",
    links: [
      { href: "/reglages", label: "Identité de l’agence" },
      { href: "/reglages/finances", label: "Finances et honoraires" },
    ],
  },
  {
    label: "Compte",
    links: [
      { href: "/compte", label: "Mon profil" },
      { href: "/compte/securite", label: "Sécurité" },
      { href: "/compte/notifications", label: "Notifications" },
      { href: "/compte/abonnement", label: "Abonnement" },
    ],
  },
];

export interface SettingsPageProps {
  currentHref: string;
  subtitle: string;
  onSubmit?: SubmitEventHandler<HTMLFormElement>;
  onCancel?: () => void;
  dirty?: boolean;
  saving?: boolean;
  formError?: string | null;
  children: ReactNode;
}

export function SettingsPage({ currentHref, subtitle, onSubmit, onCancel, dirty = false, saving = false, formError, children }: SettingsPageProps) {
  const current = SETTINGS_SECTIONS.flatMap((section) => section.links).find((link) => link.href === currentHref);
  const editable = onSubmit !== undefined;
  return (
    <form onSubmit={onSubmit} noValidate className="min-w-0">
      <PageFrame
        crumbs={[{ label: "Réglages" }, { label: current?.label ?? "Réglages" }]}
        title="Réglages"
        description={subtitle}
        actions={
          editable ? (
            <>
              <Button variant="ghost" disabled={!dirty || saving} onClick={onCancel}>
                Annuler
              </Button>
              <Button type="submit" disabled={!dirty} loading={saving}>
                Enregistrer
              </Button>
            </>
          ) : null
        }
      >
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <div className="grid min-w-0 gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label="Sections des réglages" className="flex h-fit min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface p-2">
            {SETTINGS_SECTIONS.map((section, index) => (
              <div key={section.label} className={cx("flex flex-col gap-0.5", index > 0 && "mt-1 border-t border-line pt-1")}>
                <span className="px-2 py-1 text-caption font-semibold text-fg-subtle">{section.label}</span>
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={link.href === currentHref ? "page" : undefined}
                    className={cx(
                      "rounded-sm px-2 py-1.5 text-body focus-visible:outline-2 focus-visible:outline-focus",
                      link.href === currentHref ? "bg-action-subtle font-semibold text-action-on-subtle" : "text-fg-muted hover:bg-muted",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="flex min-w-0 flex-col gap-3">{children}</div>
        </div>
      </PageFrame>
    </form>
  );
}
