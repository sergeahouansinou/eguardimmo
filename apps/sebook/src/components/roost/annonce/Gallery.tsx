import { GRADIENTS } from "@/lib/roost-data";
import type { SceneKey } from "@/lib/roost-data";

export function Gallery({ scenes }: { scenes: readonly SceneKey[] }) {
  return (
    <div
      aria-hidden="true"
      className="r-annonce-gallery"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1.46fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 8,
        height: 480,
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 36,
      }}
    >
      {scenes.map((scene, index) => (
        <div
          key={index}
          style={{
            gridRow: index === 0 ? "1 / span 2" : undefined,
            gridColumn: index === 0 ? 1 : undefined,
            position: "relative",
            overflow: "hidden",
            background: GRADIENTS[scene],
          }}
        />
      ))}
    </div>
  );
}
