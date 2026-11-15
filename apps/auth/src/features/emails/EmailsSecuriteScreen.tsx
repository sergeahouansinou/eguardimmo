"use client";

import { notFound } from "next/navigation";
import { useAuthSource } from "@/features/auth/source";
import { ButtonLink } from "@/components/TextLink";
import { ROUTES } from "@/lib/routes";

const MAILS = [
  {
    subject: "Nouvelle connexion depuis un nouvel appareil",
    lines: [
      "Bonjour Koffi, votre compte a été utilisé depuis Safari sur Mac, Paris, le 13/11/2026 à 09:42.",
      "Si ce n’était pas vous, changez votre mot de passe.",
    ],
    action: "Sécuriser mon compte",
    href: ROUTES.motDePasseOublie,
  },
  {
    subject: "Votre mot de passe a été modifié",
    lines: ["Bonjour Koffi, votre mot de passe a été modifié le 13/11/2026. Tous vos appareils ont été déconnectés."],
    action: "Ce n’était pas moi",
    href: ROUTES.motDePasseOublie,
  },
  {
    subject: "Un compte existe déjà avec cette adresse",
    lines: [
      "Quelqu’un a tenté de créer un compte avec votre adresse. Vous avez déjà un compte : connectez-vous, ou réinitialisez votre mot de passe.",
    ],
    action: "Me connecter",
    href: ROUTES.connexion,
  },
  {
    subject: "Double authentification activée",
    lines: ["La double authentification vient d’être activée sur votre compte, le 13/11/2026 à 10:05."],
    action: "Gérer la sécurité",
    href: ROUTES.compte,
  },
];

export function EmailsSecuriteScreen() {
  const source = useAuthSource();
  if (source.kind !== "demo") notFound();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">E-mails de sécurité</h1>
        <p className="text-body text-fg-muted">Envoyés avec le gabarit eGuardImmo. Aperçu des messages, les liens sont actifs.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {MAILS.map((mail) => (
          <article
            key={mail.subject}
            aria-label={mail.subject}
            className="flex min-w-0 flex-col gap-2 rounded-md border border-line bg-surface p-4 text-body text-fg-muted"
          >
            <span className="text-caption text-fg-subtle">eGuardImmo, sécurité</span>
            <h2 className="text-body-strong text-fg">{mail.subject}</h2>
            <hr className="border-line" />
            {mail.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <div className="max-w-60">
              <ButtonLink href={mail.href}>{mail.action}</ButtonLink>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
