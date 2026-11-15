"use client";

import { ArrowLeft, CircleQuestionMark, Link2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { Alert, BottomNav, Button, SideNav, Spinner } from "@eguardimmo/ui";
import type { BottomNavItem, NavEntry, NavSection } from "@eguardimmo/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ComponentProps, ReactNode } from "react";
import { useSession } from "@/features/auth/queries";
import { ROUTES, withContext } from "@/lib/routes";
import { AccountMenu } from "./AccountMenu";

function NavAnchor({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  return <Link href={href} {...props} />;
}

const SECTIONS: NavSection[] = [
  {
    id: "compte",
    label: "Mon compte",
    entries: [
      { id: "securite", label: "Sécurité", href: ROUTES.compte, icon: ShieldCheck },
      { id: "comptes-lies", label: "Comptes liés", href: ROUTES.comptesLies, icon: Link2 },
      { id: "appareils", label: "Appareils", href: ROUTES.appareils, icon: Smartphone },
      { id: "supprimer", label: "Supprimer mon compte", href: ROUTES.supprimer, icon: Trash2 },
    ],
  },
];

const FOOTER: NavEntry[] = [
  { id: "retour", label: "Retour à mon espace", href: ROUTES.profils, icon: ArrowLeft },
  { id: "aide", label: "Aide", href: "/compte/aide", icon: CircleQuestionMark },
];

const BOTTOM: BottomNavItem[] = [
  { id: "securite", label: "Sécurité", href: ROUTES.compte, icon: ShieldCheck },
  { id: "comptes-lies", label: "Comptes", href: ROUTES.comptesLies, icon: Link2 },
  { id: "appareils", label: "Appareils", href: ROUTES.appareils, icon: Smartphone },
  { id: "supprimer", label: "Supprimer", href: ROUTES.supprimer, icon: Trash2 },
  { id: "retour", label: "Mon espace", href: ROUTES.profils, icon: ArrowLeft },
];

export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.data === null) router.replace(withContext(ROUTES.connexion, { suite: pathname }));
  }, [session.data, pathname, router]);

  if (session.isError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-4">
        <Alert tone="danger" title="Impossible de charger votre compte">
          Une erreur est survenue. Vérifiez votre connexion puis réessayez.
        </Alert>
        <Button onClick={session.refetch}>Réessayer</Button>
      </div>
    );
  }

  if (!session.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size={32} label="Chargement de votre compte" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 md:px-4">
        <Link
          href={ROUTES.compte}
          aria-label="eGuardImmo, mon compte"
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Image src="/logo.png" alt="" width={24} height={24} className="size-6 rounded-full" />
        </Link>
        <span className="inline-flex h-7 items-center rounded-sm bg-action-subtle px-2.5 text-caption font-semibold text-action-on-subtle md:text-[13px]">
          Mon compte
        </span>
        <div className="ml-auto">
          <AccountMenu session={session.data} />
        </div>
      </header>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-16 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>
      <div className="flex min-h-0 flex-1">
        <span className="hidden md:contents">
          <SideNav label="Navigation du compte" sections={SECTIONS} footer={FOOTER} currentPath={pathname} linkComponent={NavAnchor} />
        </span>
        <main id="contenu" className="flex w-full min-w-0 max-w-[808px] flex-1 flex-col gap-3 p-4 pb-24 md:p-6 md:pb-6">
          {children}
        </main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <BottomNav label="Navigation rapide du compte" items={BOTTOM} currentPath={pathname} linkComponent={NavAnchor} />
      </div>
    </div>
  );
}
