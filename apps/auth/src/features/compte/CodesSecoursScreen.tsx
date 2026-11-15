"use client";

import { Copy, Download } from "lucide-react";
import { Button, Icon } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { Stepper } from "@/components/Stepper";
import { useCodesStore } from "@/features/auth/codesStore";
import { ROUTES } from "@/lib/routes";
import { useNoticeStore } from "./noticeStore";
import { PageHead, Section } from "./parts";

function download(codes: string[]) {
  const blob = new Blob([`Codes de secours eGuardImmo\n\n${codes.join("\n")}\n`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "codes-de-secours-eguardimmo.txt";
  link.click();
  URL.revokeObjectURL(url);
}

export function CodesSecoursScreen() {
  const router = useRouter();
  const regeneration = useSearchParams().get("regeneration") === "1";
  const [codes] = useState(() => useCodesStore.getState().codes);
  const clear = useCodesStore((state) => state.clear);
  const show = useNoticeStore((state) => state.show);
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);

  useEffect(() => {
    clear();
    if (codes === null) router.replace(ROUTES.compte);
  }, [clear, codes, router]);

  if (codes === null) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  };

  return (
    <>
      <PageHead
        crumbs={[{ label: "Mon compte", href: ROUTES.compte }, { label: "Sécurité", href: ROUTES.compte }, { label: "Codes de secours" }]}
        title="Codes de secours"
        description={
          regeneration
            ? "Vos anciens codes ne fonctionnent plus. Conservez ces nouveaux codes."
            : "La double authentification est activée. Conservez ces codes avant de terminer."
        }
      />
      {regeneration ? null : <Stepper steps={["Scanner le code", "Codes de secours"]} current={1} />}
      <Section id="c1" title={`Vos ${String(codes.length)} codes de secours`}>
        <FormAlert tone="warning" title="Ces codes ne s’affichent qu’une seule fois.">
          Chaque code ne fonctionne qu’une fois. Sans eux, un téléphone perdu bloque l’accès.
        </FormAlert>
        <ul aria-label="Codes de secours" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {codes.map((code) => (
            <li key={code} className="rounded-sm border border-line bg-muted px-2.5 py-2 text-center text-body-strong tracking-wider text-fg">
              {code}
            </li>
          ))}
        </ul>
        {feedback === "copied" ? (
          <FormAlert tone="success" title="Codes copiés dans le presse-papiers." />
        ) : null}
        {feedback === "failed" ? (
          <FormAlert tone="danger" title="Copie impossible." focusOnMount>
            Utilisez le bouton Télécharger ou recopiez les codes à la main.
          </FormAlert>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => { download(codes); }}>
            <Icon icon={Download} />
            Télécharger
          </Button>
          <Button variant="secondary" onClick={() => { void copy(); }}>
            <Icon icon={Copy} />
            Copier
          </Button>
          <Button
            onClick={() => {
              show(
                {
                  tone: "success",
                  title: regeneration ? "Codes de secours régénérés." : "Double authentification activée.",
                  message: "Conservez vos codes de secours en lieu sûr.",
                },
                { carry: true },
              );
              router.push(ROUTES.compte);
            }}
          >
            J’ai conservé mes codes
          </Button>
        </div>
      </Section>
    </>
  );
}
