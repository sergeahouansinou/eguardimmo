import type { ReactNode } from "react";
import Link from "next/link";
import Header from "@/components/roost/Header";
import Footer from "@/components/roost/Footer";
import { ACCENT_HOVER, BODY, CtaButton, INK, LINE, MUTED, PANEL, SERIF, SOFT } from "@/components/roost/InfoParts";
import type { JsonLd } from "@/marketplace/jsonld";
import { JsonLdScript } from "@/marketplace/JsonLdScript";

export interface Crumb {
  name: string;
  href?: string;
}

export default function InfoPage({
  eyebrow,
  title,
  lead,
  breadcrumb,
  children,
  cta,
  jsonLd,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  breadcrumb: readonly Crumb[];
  children: ReactNode;
  cta?: { text: ReactNode; href: string; label: string };
  jsonLd?: readonly JsonLd[];
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: BODY }}>
      {jsonLd?.map((node, index) => (
        <JsonLdScript key={index} data={node} />
      ))}

      <Header />

      <div style={{ background: PANEL, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: "30px 24px 44px" }}>
          <nav aria-label="Fil d’Ariane" style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.name}>
                {crumb.href ? (
                  <Link href={crumb.href} className="r-hover-underline" style={{ color: MUTED, textDecoration: "none" }}>
                    {crumb.name}
                  </Link>
                ) : (
                  <span aria-current="page" style={{ color: INK }}>
                    {crumb.name}
                  </span>
                )}
                {index < breadcrumb.length - 1 && (
                  <span aria-hidden style={{ margin: "0 8px" }}>
                    ›
                  </span>
                )}
              </span>
            ))}
          </nav>

          {eyebrow && (
            <span
              style={{
                display: "inline-block",
                fontSize: 12.5,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: ACCENT_HOVER,
                marginBottom: 12,
              }}
            >
              {eyebrow}
            </span>
          )}
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(30px, 5vw, 48px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
              color: INK,
              margin: 0,
              maxWidth: 760,
            }}
          >
            {title}
          </h1>
          {lead && <p style={{ fontSize: 18.5, color: SOFT, lineHeight: 1.6, margin: "18px 0 0", maxWidth: 680 }}>{lead}</p>}
        </div>
      </div>

      <main style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: "8px 24px 76px", color: INK, lineHeight: 1.65 }}>
        {children}

        {cta && (
          <div style={{ marginTop: 60, padding: "32px 28px", borderRadius: 18, background: INK, textAlign: "center" }}>
            <p style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600, color: "#fff" }}>{cta.text}</p>
            <CtaButton href={cta.href}>{cta.label}</CtaButton>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
