"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { BODY_TEXT, INK, SECTION_BORDER } from "./ui";

const paragraph = { fontSize: 16, lineHeight: 1.62, color: BODY_TEXT, margin: 0, overflowWrap: "anywhere" } as const;

export function Description({ paragraphs }: { paragraphs: readonly string[] }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [first, ...rest] = paragraphs;
  if (first === undefined) return null;
  return (
    <div style={{ padding: "28px 0", borderBottom: SECTION_BORDER }}>
      <p style={paragraph}>{first}</p>
      {expanded
        ? rest.map((text, index) => (
            <p key={index} style={{ ...paragraph, marginTop: 16 }}>
              {text}
            </p>
          ))
        : null}
      {rest.length > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((value) => !value);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            padding: "14px 0 0",
            minHeight: 44,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 16,
            fontWeight: 700,
            color: INK,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {expanded ? t("showLess") : t("showMore")}
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
