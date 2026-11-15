const PRINT_CSS =
  "@media print { body * { visibility: hidden !important; } [data-print-area], [data-print-area] * { visibility: visible !important; } [data-print-area] { position: absolute !important; top: 0; left: 0; width: 100% !important; margin: 0 !important; zoom: 1 !important; box-shadow: none !important; border: 0 !important; } }";

export function PrintStyles() {
  return <style>{PRINT_CSS}</style>;
}
