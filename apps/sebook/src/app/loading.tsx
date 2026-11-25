import { SkelBlock, SkelCard, SkelRegion } from "@/components/roost/Skeleton";

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <SkelBlock style={{ width: "100%", height: 72, borderRadius: 0, opacity: 0.5 }} />
      <SkelBlock style={{ width: "100%", minHeight: 420, borderRadius: 0 }} />
      <SkelRegion label="Chargement" style={{ width: "100%", maxWidth: 1520, margin: "0 auto", padding: "28px 48px 64px" }}>
        <SkelBlock style={{ height: 24, width: 240, marginBottom: 14 }} />
        <div className="cat-scroll" style={{ display: "flex", gap: 16, overflow: "hidden" }}>
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="r-card">
              <SkelCard />
            </div>
          ))}
        </div>
      </SkelRegion>
    </div>
  );
}
