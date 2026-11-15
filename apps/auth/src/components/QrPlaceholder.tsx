export function QrPlaceholder() {
  return (
    <div
      role="img"
      aria-label="QR code fictif de démonstration"
      className="size-40 shrink-0 rounded-md border border-line bg-fg/90"
      style={{ backgroundImage: "repeating-conic-gradient(var(--color-fg) 0 25%, var(--color-surface) 0 50%)", backgroundSize: "20px 20px" }}
    />
  );
}
