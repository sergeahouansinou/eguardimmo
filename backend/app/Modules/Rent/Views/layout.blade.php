<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>@yield('titre')</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font: 11pt/1.45 Helvetica, Arial, sans-serif; color: #14202A; }
  h1 { font-size: 20pt; margin: 0 0 4mm; color: #145A6B; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 8mm; font-size: 10pt; color: #334349; }
  .bloc { margin-bottom: 6mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
  th { background: #0B2E38; color: #fff; text-align: left; padding: 2mm; font-size: 9pt; text-transform: uppercase; }
  td { padding: 2mm; border-bottom: 1px solid #DDE4E5; }
  .n { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; border-top: 2px solid #145A6B; }
  .mention { margin-top: 10mm; font-size: 9pt; color: #5F7176; }
</style>
</head>
<body>
@yield('corps')
</body>
</html>
