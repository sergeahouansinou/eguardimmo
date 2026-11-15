import { cx } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "../routes";

const TABS = [
  { id: "informations", label: "Informations", href: confieRoutes.informations },
  { id: "securite", label: "Sécurité", href: confieRoutes.securite },
  { id: "notifications", label: "Notifications", href: confieRoutes.notifications },
] as const;

export function AccountTabs({ current }: { current: (typeof TABS)[number]["id"] }) {
  return (
    <nav aria-label="Mon compte" className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === current ? "page" : undefined}
          className={cx(
            "-mb-px inline-flex items-center border-b-2 px-2.5 py-2 text-body whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            tab.id === current ? "border-action font-semibold text-action-on-subtle" : "border-transparent font-medium text-fg-subtle hover:text-fg",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
