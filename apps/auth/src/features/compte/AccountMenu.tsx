"use client";

import { ChevronDown, CircleQuestionMark, Link2, LogOut, Smartphone, ShieldCheck, House } from "lucide-react";
import {
  Avatar,
  Button,
  Icon,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import type { Session } from "@/features/auth/schemas";
import { useSignOut } from "@/features/auth/queries";
import { ROUTES } from "@/lib/routes";

export function AccountMenu({ session }: { session: Session }) {
  const router = useRouter();
  const signOut = useSignOut();
  const fullName = `${session.firstName} ${session.lastName}`;
  const initials = `${session.firstName.charAt(0)}${session.lastName.charAt(0)}`;

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" aria-label={`Compte, ${fullName}`} className="gap-2 px-1.5">
          <Avatar initials={initials} size="md" />
          <span className="hidden max-w-40 truncate md:inline">{fullName}</span>
          <Icon icon={ChevronDown} />
        </Button>
      </MenuTrigger>
      <MenuContent width="md">
        <MenuLabel>{session.email}</MenuLabel>
        <MenuItem icon={ShieldCheck} onSelect={() => { router.push(ROUTES.compte); }}>
          Sécurité
        </MenuItem>
        <MenuItem icon={Link2} onSelect={() => { router.push(ROUTES.comptesLies); }}>
          Comptes liés
        </MenuItem>
        <MenuItem icon={Smartphone} onSelect={() => { router.push(ROUTES.appareils); }}>
          Appareils
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={House} onSelect={() => { router.push(ROUTES.profils); }}>
          Retour à mon espace
        </MenuItem>
        <MenuItem icon={CircleQuestionMark} onSelect={() => { router.push("/compte/aide"); }}>
          Aide
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={LogOut}
          onSelect={() => {
            void signOut.mutateAsync(undefined).then(() => { router.push(ROUTES.deconnecte); });
          }}
        >
          Se déconnecter
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
