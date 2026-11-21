<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Synthèse des revenus fonciers {{ $s['income_year'] }}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font: 10pt/1.4 Helvetica, Arial, sans-serif; color: #14202A; }
  h1 { font-size: 18pt; margin: 0 0 3mm; color: #145A6B; }
  h2 { font-size: 12pt; margin: 7mm 0 2mm; color: #145A6B; border-bottom: 1px solid #DDE4E5; padding-bottom: 1mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
  th { background: #0B2E38; color: #fff; text-align: left; padding: 1.5mm 2mm; font-size: 8.5pt; text-transform: uppercase; }
  td { padding: 1.5mm 2mm; border-bottom: 1px solid #DDE4E5; font-size: 9.5pt; }
  .n { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; border-top: 2px solid #145A6B; }
  .avertissement { border: 1px solid #B45309; background: #FFF7ED; padding: 3mm; margin: 4mm 0; font-size: 9.5pt; }
  .mention { margin-top: 6mm; font-size: 8.5pt; color: #5F7176; }
  .filigrane { position: fixed; top: 40%; left: 10%; font-size: 90pt; color: rgba(20, 90, 107, .12); transform: rotate(-30deg); }
</style>
</head>
<body>
@if ($provisoire)
<div class="filigrane">PROVISOIRE</div>
@endif
<h1>Synthèse des revenus fonciers — revenus {{ $s['income_year'] }}</h1>
<p>Déclaration n° 2044, location nue, régime réel.@if ($titulaire !== null) Contribuable : {{ $titulaire }}.@endif Référence : {{ $reference }}.</p>
<div class="avertissement">{{ $s['warning'] }}</div>
@foreach ($s['properties'] as $bien)
<h2>{{ $bien['name'] }} — {{ $bien['premises'] }} local(aux) loué(s)</h2>
<table>
<thead><tr><th>Ligne</th><th>Libellé</th><th class="n">Montant à reporter</th></tr></thead>
<tbody>
@foreach ($bien['lines'] as $l)
<tr class="{{ $l['status'] === 'total' ? 'total' : '' }}"><td>{{ $l['code'] }}</td><td>{{ $l['label'] }}@if ($l['status'] === 'to_complete') <em>— à compléter par vous si vous êtes concerné</em>@endif @if ($l['status'] === 'proposed') <em>— proposition à valider</em>@endif @if ($l['status'] === 'conflict') <em>— double source, à arbitrer</em>@endif</td><td class="n">@if ($l['status'] === 'to_complete') — @else {{ $euros($l['rounded']) }} @endif</td></tr>
@endforeach
</tbody>
</table>
@endforeach
@if (count($s['properties']) > 1)
<h2>Tous biens</h2>
<table>
<tbody>
@foreach ($s['totals'] as $l)
@if (in_array($l['code'], ['215', '240', '250', '261', '263'], true))
<tr class="total"><td>{{ $l['code'] }}</td><td>{{ $l['label'] }}</td><td class="n">{{ $euros($l['rounded']) }}</td></tr>
@endif
@endforeach
</tbody>
</table>
@endif
<h2>Micro-foncier et régime réel côte à côte</h2>
<table>
<tbody>
<tr><td>Recettes brutes (ligne 215)</td><td class="n">{{ $euros($s['micro']['gross_receipts']) }}</td></tr>
<tr><td>Base après abattement de {{ intdiv($s['micro']['allowance_bp'], 100) }} %</td><td class="n">{{ $euros($s['micro']['base_after_allowance']) }}</td></tr>
<tr><td>Base du régime réel (ligne 263 si positive)</td><td class="n">{{ $euros($s['micro']['real_base']) }}</td></tr>
</tbody>
</table>
<p class="mention">Le seuil du micro-foncier ({{ $euros($s['micro']['threshold']) }}) s'apprécie sur l'ensemble des revenus fonciers de votre foyer. Cette synthèse ne choisit pas votre régime.</p>
@if ($s['deficit'] !== null)
<h2>Simulation du déficit</h2>
<table>
<tbody>
<tr><td>Résultat (ligne 263)</td><td class="n">{{ $euros($s['deficit']['result']) }}</td></tr>
<tr><td>Part due aux intérêts d'emprunt (reportable sur les revenus fonciers)</td><td class="n">{{ $euros($s['deficit']['interest_part']) }}</td></tr>
<tr><td>Autres charges</td><td class="n">{{ $euros($s['deficit']['other_part']) }}</td></tr>
<tr><td>Imputable sur le revenu global</td><td class="n">{{ $euros($s['deficit']['imputable_on_global_income']) }}</td></tr>
<tr><td>Reportable</td><td class="n">{{ $euros($s['deficit']['carried_forward']) }}</td></tr>
</tbody>
</table>
@endif
@if (count($messages) > 0)
<h2>À savoir</h2>
<ul>
@foreach ($messages as $m)
<li>{{ $m }}</li>
@endforeach
</ul>
@endif
<div class="mention">
@foreach ($s['mentions'] as $mention)
<p>{{ $mention }}</p>
@endforeach
<p>Faites valider ces montants par un expert-comptable avant de déclarer. Montants arrondis à l'euro le plus proche, sans centimes.</p>
</div>
</body>
</html>
