<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>@yield('titre')</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font: 10pt/1.4 Helvetica, Arial, sans-serif; color: #14202A; }
  h1 { font-size: 18pt; margin: 0 0 3mm; color: #145A6B; }
  h2 { font-size: 12pt; margin: 7mm 0 2mm; color: #145A6B; border-bottom: 1px solid #DDE4E5; padding-bottom: 1mm; }
  .entete { display: flex; justify-content: space-between; margin-bottom: 6mm; font-size: 9.5pt; color: #334349; }
  .bloc { margin-bottom: 4mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
  th { background: #0B2E38; color: #fff; text-align: left; padding: 1.5mm 2mm; font-size: 8.5pt; text-transform: uppercase; }
  td { padding: 1.5mm 2mm; border-bottom: 1px solid #DDE4E5; font-size: 9.5pt; }
  .n { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; border-top: 2px solid #145A6B; }
  .mention { margin-top: 8mm; font-size: 8.5pt; color: #5F7176; }
  .filigrane { position: fixed; top: 40%; left: 10%; font-size: 90pt; color: rgba(20, 90, 107, .12); transform: rotate(-30deg); }
</style>
</head>
<body>
@yield('corps')
</body>
</html>
