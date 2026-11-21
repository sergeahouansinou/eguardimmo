<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>@yield('titre')</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font: 10.5pt/1.45 Helvetica, Arial, sans-serif; color: #14202A; }
  h1 { font-size: 20pt; margin: 0 0 3mm; color: #145A6B; }
  .parties { display: flex; justify-content: space-between; gap: 10mm; margin-bottom: 8mm; }
  .parties > div { width: 48%; }
  .meta { margin-bottom: 6mm; color: #334349; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
  th { background: #0B2E38; color: #fff; text-align: left; padding: 2mm; font-size: 8.5pt; text-transform: uppercase; }
  td { padding: 2mm; border-bottom: 1px solid #DDE4E5; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; border-top: 2px solid #145A6B; }
  .mentions { margin-top: 8mm; font-size: 8.5pt; color: #5F7176; }
  .mentions p { margin: 0 0 1.5mm; }
</style>
</head>
<body>
@yield('corps')
</body>
</html>
