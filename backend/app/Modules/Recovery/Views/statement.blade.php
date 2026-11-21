@php($f = fn (int $m): string => \App\Modules\Recovery\Support\MoneyFormat::fr($m, $s['currency']))
@php($d = fn (string $iso): string => \Carbon\CarbonImmutable::parse($iso)->format('d/m/Y'))
@extends('recovery::layout')
@section('titre', 'Décompte '.$s['case']['number'])
@section('corps')
<h1>Décompte des sommes dues</h1>
<div class="meta">
  <div><strong>{{ $s['issuer']['name'] }}</strong></div>
  <div>Dossier {{ $s['case']['number'] }}<br>Envoi {{ $s['bundle_number'] }}<br>Établi le {{ $d($s['generated_on']) }}</div>
</div>
<div class="bloc">
  <strong>Débiteur</strong> : {{ $s['debtor']['name'] }}<br>
  <strong>Bail</strong> : {{ $s['lease']['reference'] }}
</div>
<table>
  <thead><tr><th>Créance</th><th>Échéance</th><th class="n">Appelé</th><th class="n">Reste dû</th></tr></thead>
  <tbody>
  @foreach ($s['lines'] as $ligne)
    <tr>
      <td>@if ($ligne['type'] === 'invoice')Facture {{ $ligne['reference'] }} du {{ $d($ligne['issued_on']) }}@else Loyer du {{ $d($ligne['period_start']) }} au {{ $d($ligne['period_end']) }}@endif</td>
      <td>{{ $d($ligne['due_date']) }}</td>
      <td class="n">{{ $f($ligne['total']) }}</td>
      <td class="n">{{ $f($ligne['outstanding']) }}</td>
    </tr>
  @endforeach
    <tr class="total"><td colspan="2">Total</td><td class="n">{{ $f($s['totals']['called']) }}</td><td class="n">{{ $f($s['totals']['outstanding']) }}</td></tr>
  </tbody>
</table>
<p class="mention">Restes dus lus au grand livre à la date d'établissement du décompte.</p>
@endsection
