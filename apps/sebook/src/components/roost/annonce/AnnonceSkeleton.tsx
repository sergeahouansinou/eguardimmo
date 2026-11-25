import { SkelBlock, SkelRegion } from "../Skeleton";

export function AnnonceSkeleton() {
  return (
    <SkelRegion label="Chargement de l’annonce" className="r-annonce-main" style={{ width: "100%", maxWidth: 1280, margin: "0 auto", padding: "30px 40px 64px" }}>
      <SkelBlock style={{ height: 32, width: "min(560px, 100%)", marginBottom: 18 }} />
      <div
        className="r-annonce-gallery"
        style={{ display: "grid", gridTemplateColumns: "1.46fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 8, height: 480, borderRadius: 18, overflow: "hidden", marginBottom: 36 }}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <SkelBlock key={index} style={{ borderRadius: 0, gridRow: index === 0 ? "1 / span 2" : undefined, gridColumn: index === 0 ? 1 : undefined }} />
        ))}
      </div>
      <div className="r-annonce-cols" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: 680, display: "flex", flexDirection: "column", gap: 12 }}>
          <SkelBlock style={{ height: 24, width: "70%" }} />
          <SkelBlock style={{ height: 16, width: "50%" }} />
          <SkelBlock style={{ height: 16, width: "100%", marginTop: 16 }} />
          <SkelBlock style={{ height: 16, width: "92%" }} />
          <SkelBlock style={{ height: 16, width: "85%" }} />
        </div>
        <SkelBlock className="r-annonce-booking" style={{ flex: "0 0 372px", height: 320, borderRadius: 16 }} />
      </div>
    </SkelRegion>
  );
}
