"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { FONTS } from "@/lib/roost-data";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  labelledBy: string;
  onClose: () => void;
  canClose?: boolean;
  maxWidth: number;
  zIndex?: number;
  children: ReactNode;
}

export function Modal({ labelledBy, onClose, canClose = true, maxWidth, zIndex = 200, children }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const canCloseRef = useRef(canClose);

  useEffect(() => {
    closeRef.current = onClose;
    canCloseRef.current = canClose;
  });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const element = panel.current;
    const first = element?.querySelector<HTMLElement>("[data-autofocus]") ?? element?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? element)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (canCloseRef.current) closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !element) return;
      const items = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const head = items[0];
      const tail = items.at(-1);
      if (!head || !tail) return;
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canClose) onClose();
      }}
      style={{ position: "fixed", inset: 0, zIndex, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="cat-scroll"
        style={{
          background: "#fff",
          borderRadius: 18,
          width: "100%",
          maxWidth,
          maxHeight: "86vh",
          overflowY: "auto",
          fontFamily: FONTS.body,
          boxShadow: "0 18px 48px rgba(0,0,0,.28)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
