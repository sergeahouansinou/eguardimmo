"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { SubmitEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Modal } from "./annonce/Modal";
import { INK, MUTED, closeBtnStyle, reserveBtn } from "./annonce/ui";
import { MESSAGE_MAX, SLOT_MAX, visitIssue, visitSchema } from "@/features/listing/visitForm";
import type { VisitFormValues, VisitIssue } from "@/features/listing/visitForm";
import { useSession } from "@/features/session/SessionProvider";
import { currentPageUrl, verifyEmailHref } from "@/features/session/signIn";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n/context";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import { ACCENT, FONTS } from "@/lib/roost-data";
import { describeFailure } from "@/marketplace/errors";
import { sendVisitRequest } from "@/marketplace/requests";

interface ContactHostModalProps {
  reference: string;
  hostName: string | null;
  onClose: () => void;
}

const ISSUE_KEYS: Record<VisitIssue, I18nKey> = {
  slotRequired: "ficheVisitSlotRequired",
  slotTooLong: "ficheVisitSlotTooLong",
  messageTooLong: "ficheVisitMessageTooLong",
};

const fieldStyle = (invalid: boolean) =>
  ({
    width: "100%",
    border: `1px solid ${invalid ? "#C0392B" : "#C9C3BA"}`,
    borderRadius: 12,
    padding: "13px 14px",
    fontFamily: "inherit",
    fontSize: 15,
    color: INK,
    lineHeight: 1.5,
  }) as const;

const labelStyle = { display: "block", fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 } as const;

export default function ContactHostModal({ reference, hostName, onClose }: ContactHostModalProps) {
  const t = useT();
  const ids = { title: useId(), slot: useId(), message: useId(), slotError: useId(), messageError: useId() };
  const { client, authUrl } = useSession();
  const { openAuth } = useAuth();
  const [sent, setSent] = useState(false);
  const form = useForm<VisitFormValues>({ resolver: zodResolver(visitSchema), defaultValues: { desiredSlot: "", message: "" } });
  const message = useWatch({ control: form.control, name: "message" });
  const mutation = useMutation({
    mutationFn: (values: VisitFormValues) => sendVisitRequest(client, reference, { desiredSlot: values.desiredSlot, message: values.message }),
    onSuccess: () => {
      setSent(true);
    },
    onError: (error) => {
      if (describeFailure(error).kind === "unauthenticated") openAuth("login");
    },
  });
  const failure = mutation.isError ? describeFailure(mutation.error) : null;
  const verifyHref = failure?.kind === "unverified" ? verifyEmailHref(authUrl, currentPageUrl()) : null;
  const errors = form.formState.errors;
  const slotIssue = visitIssue(errors.desiredSlot?.message);
  const messageIssue = visitIssue(errors.message?.message);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void form.handleSubmit((values) => {
      mutation.mutate(values);
    })(event);
  };

  return (
    <Modal labelledBy={ids.title} maxWidth={540} zIndex={220} canClose={!mutation.isPending} onClose={onClose}>
      <div style={{ padding: "26px 30px 30px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
          <h2 id={ids.title} style={{ fontFamily: FONTS.ui, fontWeight: 800, fontSize: 22, letterSpacing: "-0.01em", color: INK, margin: 0 }}>
            {t("requestViewing")}
          </h2>
          <button type="button" aria-label={t("contactClose")} onClick={onClose} disabled={mutation.isPending} className="r-hover-soft" style={closeBtnStyle}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {sent ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16, padding: "26px 8px 8px" }}>
            <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="#fff">
                <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
              </svg>
            </span>
            <p style={{ fontSize: 16, color: "#3F3A35", margin: 0, lineHeight: 1.5 }}>{hostName ? t("ficheVisitSent", { name: hostName }) : t("ficheVisitSentNoHost")}</p>
            <button type="button" data-autofocus onClick={onClose} className="r-hover-soft" style={{ background: INK, color: "#fff", border: "none", borderRadius: 11, padding: "13px 26px", minHeight: 44, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600 }}>
              {t("contactClose")}
            </button>
          </div>
        ) : (
          <form noValidate onSubmit={submit}>
            <p style={{ fontSize: 14, color: MUTED, margin: "0 0 18px", lineHeight: 1.5 }}>{hostName ? t("ficheVisitSubtitle", { name: hostName }) : t("ficheVisitSubtitleNoHost")}</p>

            {failure ? (
              <p role="alert" style={{ fontSize: 14, color: "#C0392B", margin: "0 0 16px", lineHeight: 1.5 }}>
                {failure.message}
                {verifyHref ? (
                  <>
                    {" "}
                    <a href={verifyHref} style={{ color: "#C0392B", textDecoration: "underline" }}>
                      {t("ficheVerifyEmail")}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}

            <label htmlFor={ids.slot} style={labelStyle}>
              {t("ficheVisitSlotLabel")}
            </label>
            <input
              id={ids.slot}
              type="text"
              maxLength={SLOT_MAX}
              placeholder={t("ficheVisitSlotPlaceholder")}
              aria-invalid={slotIssue !== null}
              aria-describedby={slotIssue ? ids.slotError : undefined}
              disabled={mutation.isPending}
              style={fieldStyle(slotIssue !== null)}
              data-autofocus
              {...form.register("desiredSlot")}
            />
            <p id={ids.slotError} style={{ fontSize: 13, color: "#C0392B", margin: "6px 0 16px", minHeight: 18 }}>
              {slotIssue ? t(ISSUE_KEYS[slotIssue], { n: SLOT_MAX }) : ""}
            </p>

            <label htmlFor={ids.message} style={labelStyle}>
              {t("ficheVisitMessageLabel")}
            </label>
            <textarea
              id={ids.message}
              rows={5}
              maxLength={MESSAGE_MAX}
              placeholder={t("ficheVisitMessagePlaceholder")}
              aria-invalid={messageIssue !== null}
              aria-describedby={messageIssue ? ids.messageError : undefined}
              disabled={mutation.isPending}
              style={{ ...fieldStyle(messageIssue !== null), resize: "vertical" }}
              {...form.register("message")}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6, minHeight: 18 }}>
              <span id={ids.messageError} style={{ fontSize: 13, color: "#C0392B" }}>
                {messageIssue ? t(ISSUE_KEYS[messageIssue], { n: MESSAGE_MAX }) : ""}
              </span>
              <span style={{ fontSize: 12, color: "#6E6A66", flex: "0 0 auto" }}>{`${String(message.length)}/${String(MESSAGE_MAX)}`}</span>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="r-reserve"
              style={{ ...reserveBtn, marginTop: 14, cursor: mutation.isPending ? "default" : "pointer", opacity: mutation.isPending ? 0.6 : 1 }}
            >
              {mutation.isPending ? t("contactSending") : t("ficheVisitSend")}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
