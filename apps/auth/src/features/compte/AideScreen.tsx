"use client";

import { ArrowRight } from "lucide-react";
import { Icon, Spinner } from "@eguardimmo/ui";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useReturnContext } from "@/features/auth/useReturnContext";
import { redirectTo } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { PageHead, Section } from "./parts";

export const SUPPORT_EMAIL = "support@eguardimmo.example";

const CRUMBS = [{ label: "Mon compte", href: ROUTES.compte }, { label: "Aide" }];

const QUESTIONS = [
  {
    id: "mot-de-passe",
    question: "J’ai oublié mon mot de passe",
    answer: "Demandez un lien de réinitialisation depuis la page de connexion. Le lien est valable une durée limitée et à usage unique.",
    href: ROUTES.motDePasseOublie,
    action: "Réinitialiser mon mot de passe",
  },
  {
    id: "double-authentification",
    question: "Comment activer la double authentification ?",
    answer: "Elle se règle dans la sécurité du compte : scannez le QR code avec une application d’authentification, puis saisissez le code à 6 chiffres.",
    href: ROUTES.doubleAuthentification,
    action: "Activer la double authentification",
  },
  {
    id: "codes-secours",
    question: "J’ai perdu mon téléphone, comment me connecter ?",
    answer: "Utilisez un code de secours, à usage unique, depuis l’écran de saisie du code. Pensez à en générer de nouveaux ensuite.",
    href: ROUTES.codesSecours,
    action: "Gérer mes codes de secours",
  },
  {
    id: "appareils",
    question: "Comment déconnecter un appareil inconnu ?",
    answer: "La liste des appareils connectés permet de fermer une session à distance, ou toutes les autres sessions d’un coup.",
    href: ROUTES.appareils,
    action: "Voir mes appareils",
  },
  {
    id: "comptes-lies",
    question: "Comment lier ou délier Google ou Apple ?",
    answer: "Depuis les comptes liés. Gardez toujours un moyen de connexion actif (mot de passe ou compte lié) avant de délier.",
    href: ROUTES.comptesLies,
    action: "Gérer mes comptes liés",
  },
  {
    id: "suppression",
    question: "Comment supprimer mon compte ?",
    answer: "La suppression est définitive et demande une confirmation. Elle est refusée tant qu’un espace dont vous êtes l’unique administrateur reste actif.",
    href: ROUTES.supprimer,
    action: "Supprimer mon compte",
  },
] as const;

function SpaceHelpRedirect({ url }: { url: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    redirectTo(url);
  }, [url]);
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Spinner size={32} label="Ouverture de l’aide de votre espace" />
      <p className="text-body text-fg-muted">Ouverture de l’aide de votre espace.</p>
      <a
        href={url}
        className="inline-flex items-center gap-1 rounded-sm px-0.5 text-caption font-medium text-action-on-subtle underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Rien ne se passe ? Ouvrir l’aide <Icon icon={ArrowRight} size={14} />
      </a>
    </div>
  );
}

function StaticHelp() {
  return (
    <>
      <PageHead
        crumbs={CRUMBS}
        title="Aide"
        description="Réponses aux questions fréquentes sur votre compte et sa sécurité. L’aide propre à un espace se trouve dans l’espace concerné."
      />
      <Section id="aide-faq" title="Questions fréquentes">
        <ul className="flex flex-col divide-y divide-line">
          {QUESTIONS.map((item) => (
            <li key={item.id}>
              <details className="py-2">
                <summary className="cursor-pointer list-none rounded-sm py-1 text-body-strong text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  {item.question}
                </summary>
                <div className="flex flex-col items-start gap-2 pt-1 pb-2">
                  <p className="text-body text-fg-muted">{item.answer}</p>
                  <Link
                    href={item.href}
                    className="rounded-sm text-caption font-medium text-action-on-subtle underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {item.action}
                  </Link>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="aide-contact" title="Contacter le support">
        <p className="text-body text-fg-muted">
          Vous ne trouvez pas la réponse ? Écrivez-nous en précisant l’adresse e-mail de votre compte. Ne communiquez jamais votre
          mot de passe ni un code de vérification.
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="self-start rounded-sm text-body-strong text-action-on-subtle underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {SUPPORT_EMAIL}
        </a>
      </Section>
    </>
  );
}

export function AideScreen() {
  const { returnTo } = useReturnContext();
  if (returnTo.status === "ok") return <SpaceHelpRedirect url={new URL("/aide", returnTo.url).href} />;
  return <StaticHelp />;
}
