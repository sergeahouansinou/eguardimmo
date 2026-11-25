import type { IconPath } from "@/lib/roost-data";

export function CategoryIcon({ d, size = 25 }: { d: IconPath | IconPath[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) =>
        typeof p === "string" ? (
          <path key={i} d={p} />
        ) : (
          <circle key={i} cx={p.a.cx} cy={p.a.cy} r={p.a.r} />
        )
      )}
    </svg>
  );
}

export function Heart({ faved }: { faved: boolean }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 32 32"
      style={{ fill: faved ? "#85C920" : "rgba(0,0,0,0.45)", stroke: "#fff", strokeWidth: 2, overflow: "visible", display: "block" }}
    >
      <path d="M16 28.4c-.4 0-.8-.1-1.1-.4C8.2 22.5 4 18.4 4 12.9 4 8.6 7.2 5.4 11.2 5.4c2 0 3.8.9 4.8 2.4 1-1.5 2.8-2.4 4.8-2.4 4 0 7.2 3.2 7.2 7.5 0 5.5-4.2 9.6-10.9 15.1-.3.3-.7.4-1.1.4Z" />
    </svg>
  );
}

export function GlobeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M3 12h18M12 2.8c2.6 2.4 4 5.7 4 9.2s-1.4 6.8-4 9.2c-2.6-2.4-4-5.7-4-9.2s1.4-6.8 4-9.2Z" />
    </svg>
  );
}
