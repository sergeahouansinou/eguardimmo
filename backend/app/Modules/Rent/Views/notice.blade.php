@php($f = fn (int $m): string => \App\Modules\Rent\Support\MoneyFormat::fr($m, $s['currency']))
@php($d = fn (string $iso): string => \Carbon\CarbonImmutable::parse($iso)->format('d/m/Y'))
@extends('rent::layout')
@section('titre', 'Avis d\'échéance '.$s['number'])
@section('corps')
<h1>Avis d'échéance</h1>
<div class="meta">
  <div><strong>{{ $s['issuer']['name'] }}</strong></div>
  <div>N° {{ $s['number'] }}<br>Émis le {{ $d($s['issued_on']) }}</div>
</div>
<div class="bloc">
  <strong>Locataire{{ count($s['tenants']) > 1 ? 's' : '' }}</strong> : {{ implode(', ', array_column($s['tenants'], 'name')) }}<br>
  <strong>Bail</strong> : {{ $s['lease']['reference'] }}<br>
  @if ($s['unit'])
  <strong>Logement</strong> : {{ $s['unit']['property_name'] }} — {{ $s['unit']['reference'] }}, {{ $s['unit']['address']['line1'] }}, {{ $s['unit']['address']['postal_code'] }} {{ $s['unit']['address']['city'] }}<br>
  @endif
  <strong>Période</strong> : du {{ $d($s['period']['start']) }} au {{ $d($s['period']['end']) }}<br>
  <strong>À payer avant le</strong> : {{ $d($s['period']['due_date']) }}
</div>
<table>
  <thead><tr><th>Désignation</th><th class="n">Montant</th></tr></thead>
  <tbody>
  @foreach ($s['lines'] as $ligne)
    <tr><td>{{ $ligne['label'] }}</td><td class="n">{{ $f($ligne['amount']) }}</td></tr>
  @endforeach
    <tr><td>Sous-total loyer</td><td class="n">{{ $f($s['amounts']['rent']) }}</td></tr>
    <tr><td>Sous-total charges</td><td class="n">{{ $f($s['amounts']['charges']) }}</td></tr>
    @if ($s['amounts']['vat'] > 0)
    <tr><td>TVA</td><td class="n">{{ $f($s['amounts']['vat']) }}</td></tr>
    @endif
    <tr class="total"><td>Total à payer</td><td class="n">{{ $f($s['amounts']['total']) }}</td></tr>
  </tbody>
</table>
<p class="mention">{{ $s['mention'] }}</p>
@endsection
