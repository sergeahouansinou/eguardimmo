"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/context";
import { FONTS } from "@/lib/roost-data";

interface CancelDialogProps {
  description: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function CancelDialog({ description, pending, onConfirm, onClose }: CancelDialogProps) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    keep.current?.focus();
    return () => {
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pending, onClose]);

  return (
    <div
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
      style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="acc-dialog-title"
        aria-describedby="acc-dialog-text"
        style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 480, padding: "26px 28px 28px", fontFamily: FONTS.body, boxShadow: "0 18px 48px rgba(0,0,0,.28)" }}
      >
        <h2 id="acc-dialog-title" style={{ fontFamily: FONTS.ui, fontWeight: 800, fontSize: 22, letterSpacing: "-0.01em", color: "#231F1C", margin: "0 0 10px" }}>
          {t("acc_dialogTitle")}
        </h2>
        <p id="acc-dialog-text" style={{ fontSize: 15, lineHeight: 1.55, color: "#3F3A35", margin: "0 0 24px" }}>
          {description}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }}>
          <button
            ref={keep}
            type="button"
            onClick={onClose}
            disabled={pending}
            className="r-hover-soft"
            style={{ background: "#F4F1ED", color: "#231F1C", border: "none", borderRadius: 12, padding: "12px 22px", minHeight: 48, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.5 : 1 }}
          >
            {t("acc_keep")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            style={{ background: "#B42318", color: "#fff", border: "none", borderRadius: 12, padding: "12px 22px", minHeight: 48, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.7 : 1 }}
          >
            {pending ? t("acc_cancelling") : t("acc_confirmCancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
