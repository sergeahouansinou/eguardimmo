@php($f = fn (int $m): string => \App\Modules\Rent\Support\MoneyFormat::fr($m, $s['currency']))
@php($d = fn (string $iso): string => \Carbon\CarbonImmutable::parse($iso)->format('d/m/Y'))
@extends('rent::layout')
@section('titre', 'Quittance '.$s['number'])
@section('corps')
<h1>Quittance de loyer</h1>
<div class="meta">
  <div><strong>{{ $s['issuer']['name'] }}</strong></div>
  <div>N° {{ $s['number'] }}<br>Émise le {{ $d($s['issued_on']) }}</div>
</div>
<div class="bloc">
  <strong>Locataire{{ count($s['tenants']) > 1 ? 's' : '' }}</strong> : {{ implode(', ', array_column($s['tenants'], 'name')) }}<br>
  <strong>Bail</strong> : {{ $s['lease']['reference'] }}<br>
  @if ($s['unit'])
  <strong>Logement</strong> : {{ $s['unit']['property_name'] }} — {{ $s['unit']['reference'] }}, {{ $s['unit']['address']['line1'] }}, {{ $s['unit']['address']['postal_code'] }} {{ $s['unit']['address']['city'] }}<br>
  @endif
  <strong>Période</strong> : du {{ $d($s['period']['start']) }} au {{ $d($s['period']['end']) }}<br>
  <strong>Soldée le</strong> : {{ $d($s['paid_on']) }}
</div>
<p>Je soussigné, {{ $s['issuer']['name'] }}, déclare avoir reçu de {{ implode(', ', array_column($s['tenants'], 'name')) }} la somme de <strong>{{ $f($s['amounts']['total']) }}</strong> au titre du loyer et des charges de la période ci-dessus, et lui en donne quittance.</p>
<table>
  <thead><tr><th>Désignation</th><th class="n">Montant</th></tr></thead>
  <tbody>
    <tr><td>Loyer</td><td class="n">{{ $f($s['amounts']['rent']) }}</td></tr>
    <tr><td>Charges</td><td class="n">{{ $f($s['amounts']['charges']) }}</td></tr>
    @if ($s['amounts']['vat'] > 0)
    <tr><td>TVA</td><td class="n">{{ $f($s['amounts']['vat']) }}</td></tr>
    @endif
    <tr class="total"><td>Total acquitté</td><td class="n">{{ $f($s['amounts']['total']) }}</td></tr>
  </tbody>
</table>
<p class="mention">{{ $s['mention'] }}</p>
@endsection
