import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

const itemStyle = (weight: number, color: string): CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  padding: "11px 18px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: weight,
  color,
  textDecoration: "none",
  boxSizing: "border-box",
});

export function MenuButton({ children, onClick, weight = 400, color = "#231F1C" }: { children: ReactNode; onClick: () => void; weight?: number; color?: string }) {
  return (
    <button type="button" role="menuitem" className="r-hover-soft" onClick={onClick} style={itemStyle(weight, color)}>
      {children}
    </button>
  );
}

export function MenuLink({ href, children, onClick, external = false }: { href: string; children: ReactNode; onClick: () => void; external?: boolean }) {
  if (external) {
    return (
      <a role="menuitem" className="r-hover-soft" href={href} onClick={onClick} style={itemStyle(400, "#231F1C")}>
        {children}
      </a>
    );
  }
  return (
    <Link role="menuitem" className="r-hover-soft" href={href} onClick={onClick} style={itemStyle(400, "#231F1C")}>
      {children}
    </Link>
  );
}

export function MenuDivider({ margin = "8px 0" }: { margin?: string }) {
  return <div role="separator" style={{ height: 1, background: "#EFEBE6", margin }} />;
}
