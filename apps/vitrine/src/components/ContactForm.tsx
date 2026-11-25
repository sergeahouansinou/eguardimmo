"use client";

import { Alert, Button, Checkbox, RadioGroup, TextField, Textarea } from "@eguardimmo/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { z } from "zod";
import { CONTACT_PROFILE_LABELS, CONTACT_PROFILES, contactSchema, fieldErrors } from "@/lib/contact/schema";

type Status = "idle" | "sending" | "sent" | "failed";

interface Values {
  organisation: string;
  email: string;
  profil: string;
  message: string;
  consentement: boolean;
  siteWeb: string;
}

const EMPTY: Values = { organisation: "", email: "", profil: "", message: "", consentement: false, siteWeb: "" };

const PROFILE_OPTIONS = CONTACT_PROFILES.map((value) => ({ value, label: CONTACT_PROFILE_LABELS[value] }));

const FOCUS_ORDER = ["organisation", "email", "profil", "message", "consentement"] as const;

const serverResponse = z.object({ message: z.string(), errors: z.record(z.string(), z.string()).optional() });

interface ContactFormProps {
  contactEmail: string | undefined;
}

export function ContactForm({ contactEmail }: ContactFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    if (status === "failed") failureRef.current?.focus();
  }, [status]);

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const focusFirstError = (found: Record<string, string>) => {
    const first = FOCUS_ORDER.find((key) => key in found);
    if (first === undefined) return;
    const target = first === "profil" ? formRef.current?.querySelector<HTMLElement>('input[type="radio"]') : document.getElementById(`contact-${first}`);
    target?.focus();
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    const message = values.message.trim();
    const parsed = contactSchema.safeParse({ ...values, message: message === "" ? undefined : message, siteWeb: values.siteWeb === "" ? undefined : values.siteWeb });
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      focusFirstError(found);
      return;
    }
    setErrors({});
    setFailure("");
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 202) {
        setStatus("sent");
        return;
      }
      const body = serverResponse.safeParse(await response.json().catch(() => null));
      if (body.success && body.data.errors) {
        setErrors(body.data.errors);
        focusFirstError(body.data.errors);
      }
      setFailure(body.success ? body.data.message : "L’envoi a échoué : votre demande n’a pas été transmise.");
    } catch {
      setFailure("Connexion impossible : votre demande n’a pas été transmise. Vérifiez votre connexion et réessayez.");
    }
    setStatus("failed");
  };

  if (status === "sent") {
    return (
      <Alert tone="success" title="Demande transmise">
        Merci, votre demande a bien été transmise.
      </Alert>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={(event) => void submit(event)} className="relative flex flex-col gap-4" aria-label="Demande de démonstration">
      {status === "failed" ? (
        <Alert ref={failureRef} tabIndex={-1} tone="danger" title="Demande non transmise">
          {failure}
          {contactEmail ? (
            <>
              {" "}
              Vous pouvez nous écrire à <a href={`mailto:${contactEmail}`} className="underline underline-offset-3">{contactEmail}</a>.
            </>
          ) : null}
        </Alert>
      ) : null}
      <TextField
        id="contact-organisation"
        name="organisation"
        label="Nom de l’organisation"
        placeholder="ex. Agence Rhône Immo"
        autoComplete="organization"
        maxLength={120}
        required
        value={values.organisation}
        onChange={(event) => { update("organisation", event.target.value); }}
        error={errors.organisation}
        className="min-h-11"
      />
      <TextField
        id="contact-email"
        name="email"
        type="email"
        label="E-mail professionnel"
        placeholder="ex. contact@agence-exemple.fr"
        autoComplete="email"
        maxLength={254}
        required
        value={values.email}
        onChange={(event) => { update("email", event.target.value); }}
        error={errors.email}
        className="min-h-11"
      />
      <RadioGroup label="Votre profil" options={PROFILE_OPTIONS} value={values.profil} onValueChange={(value) => { update("profil", value); }} error={errors.profil} />
      <Textarea
        id="contact-message"
        name="message"
        label="Message (facultatif)"
        placeholder="ex. Nous gérons environ 120 lots et souhaitons voir la gestion des mandats."
        maxLength={1000}
        value={values.message}
        onChange={(event) => { update("message", event.target.value); }}
        error={errors.message}
      />
      <div className="flex flex-col gap-1">
        <Checkbox
          id="contact-consentement"
          name="consentement"
          label="J’accepte que ces informations soient utilisées pour répondre à ma demande"
          checked={values.consentement}
          onChange={(event) => { update("consentement", event.target.checked); }}
          aria-describedby={errors.consentement ? "contact-consentement-erreur" : undefined}
          aria-invalid={errors.consentement ? true : undefined}
        />
        {errors.consentement ? (
          <p id="contact-consentement-erreur" className="text-caption text-fg-danger">
            {errors.consentement}
          </p>
        ) : null}
        <p className="text-caption text-fg-subtle">
          Voir la <Link href="/confidentialite" className="underline underline-offset-3">politique de confidentialité</Link>.
        </p>
      </div>
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <input name="siteWeb" tabIndex={-1} autoComplete="off" value={values.siteWeb} onChange={(event) => { update("siteWeb", event.target.value); }} />
      </div>
      <div>
        <Button type="submit" size="lg" loading={status === "sending"} className="min-h-11 w-full px-5 sm:w-auto">
          Envoyer ma demande
        </Button>
      </div>
    </form>
  );
}
