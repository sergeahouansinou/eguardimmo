import { AnnonceSkeleton } from "@/components/roost/annonce/AnnonceSkeleton";
import { SkelBlock } from "@/components/roost/Skeleton";

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <SkelBlock style={{ width: "100%", height: 72, borderRadius: 0, opacity: 0.5 }} />
      <AnnonceSkeleton />
    </div>
  );
}
