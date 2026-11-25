"use client";

import { createContext, use, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FONTS } from "@/lib/roost-data";

export interface ToastInput {
  tone: "success" | "danger" | "info";
  title: string;
  description?: string | undefined;
}

interface ToastApi {
  show: (toast: ToastInput) => void;
}

interface ToastEntry extends ToastInput {
  id: number;
}

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const counter = useRef(0);
  const show = useCallback((toast: ToastInput) => {
    counter.current += 1;
    const id = counter.current;
    setEntries((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setEntries((current) => current.filter((entry) => entry.id !== id));
    }, TOAST_MS);
  }, []);
  const api = useMemo<ToastApi>(() => ({ show }), [show]);
  return (
    <ToastContext value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        style={{ position: "fixed", left: 0, right: 0, bottom: 24, zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", padding: "0 16px" }}
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              pointerEvents: "auto",
              maxWidth: 440,
              background: "#231F1C",
              color: "#fff",
              borderRadius: 14,
              padding: "12px 18px",
              boxShadow: "0 12px 32px rgba(0,0,0,.28)",
              borderLeft: `4px solid ${entry.tone === "danger" ? "#C0392B" : entry.tone === "success" ? "#85C920" : "#84BACB"}`,
              fontFamily: FONTS.ui,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{entry.title}</div>
            {entry.description ? <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{entry.description}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("ToastProvider manquant autour de SeBook.");
  return api;
}
