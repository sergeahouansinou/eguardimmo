@php($f = fn (int $m): string => \App\Modules\Invoicing\Support\MoneyFormat::fr($m, $s['currency']))
@php($d = fn (?string $iso): string => $iso === null ? '' : \Carbon\CarbonImmutable::parse($iso)->format('d/m/Y'))
@php($adresse = fn (?array $a): string => $a === null ? '' : trim($a['line1'].' '.($a['line2'] ?? '').', '.$a['postal_code'].' '.$a['city']))
@extends('invoicing::layout')
@section('titre', ($s['kind'] === 'credit_note' ? 'Avoir ' : 'Facture ').$s['number'])
@section('corps')
<h1>{{ $s['kind'] === 'credit_note' ? 'Avoir' : 'Facture' }} {{ $s['number'] }}</h1>
<div class="meta">
  Émis{{ $s['kind'] === 'credit_note' ? '' : 'e' }} le {{ $d($s['issued_on']) }}
  @if ($s['due_on']) · Échéance de règlement : {{ $d($s['due_on']) }} @endif
  @if ($s['service']['from']) · Prestation du {{ $d($s['service']['from']) }} au {{ $d($s['service']['to'] ?? $s['service']['from']) }} @endif
  @if ($s['references']['credited_invoice']) <br>Avoir sur la facture {{ $s['references']['credited_invoice']['number'] }} du {{ $d($s['references']['credited_invoice']['issued_on']) }} — motif : {{ $s['credit_reason'] }} @endif
  @if ($s['references']['lease']) <br>Bail : {{ $s['references']['lease']['reference'] }} @endif
  @if ($s['references']['mandate']) <br>Mandat : {{ $s['references']['mandate']['reference'] }} @endif
</div>
<div class="parties">
  <div>
    <strong>{{ $s['issuer']['legal_name'] }}</strong><br>
    {{ $adresse($s['issuer']['address']) }}<br>
    SIREN {{ $s['issuer']['siren'] }}@if ($s['issuer']['siret']) · SIRET {{ $s['issuer']['siret'] }}@endif<br>
    @if ($s['issuer']['vat_number']) TVA {{ $s['issuer']['vat_number'] }}<br>@endif
    @if ($s['issuer']['legal_form']) {{ $s['issuer']['legal_form'] }}@if ($s['issuer']['share_capital'] !== null) au capital de {{ $f($s['issuer']['share_capital']) }}@endif<br>@endif
    @if ($s['issuer']['professional_card_number']) Carte professionnelle n° {{ $s['issuer']['professional_card_number'] }}@if ($s['issuer']['professional_card_issuer']) ({{ $s['issuer']['professional_card_issuer'] }})@endif<br>@endif
    @if ($s['issuer']['guarantee_provider']) Garantie financière : {{ $s['issuer']['guarantee_provider'] }}@if ($s['issuer']['guarantee_amount'] !== null) ({{ $f($s['issuer']['guarantee_amount']) }})@endif<br>@endif
  </div>
  <div>
    <strong>Destinataire</strong><br>
    {{ $s['recipient']['name'] }}<br>
    {{ $adresse($s['recipient']['address']) }}<br>
    @if ($s['recipient']['siren']) SIREN {{ $s['recipient']['siren'] }}<br>@endif
    @if ($s['recipient']['vat_number']) TVA {{ $s['recipient']['vat_number'] }}<br>@endif
  </div>
</div>
<table>
  <thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">PU HT</th><th class="n">TVA</th><th class="n">Total HT</th></tr></thead>
  <tbody>
    @foreach ($s['lines'] as $l)
    <tr>
      <td>{{ $l['description'] }}</td>
      <td class="n">{{ \App\Modules\Invoicing\Support\MoneyFormat::quantity($l['quantity_milli']) }}</td>
      <td class="n">{{ $f($l['unit_price']) }}</td>
      <td class="n">{{ $l['tax_category'] === 'S' ? \App\Modules\Invoicing\Support\MoneyFormat::rate($l['tax_rate_pcm']) : $l['tax_category'] }}</td>
      <td class="n">{{ $f($l['net_amount']) }}</td>
    </tr>
    @endforeach
  </tbody>
</table>
<table>
  <thead><tr><th>Taxe</th><th class="n">Base</th><th class="n">Taux</th><th class="n">Montant</th></tr></thead>
  <tbody>
    @foreach ($s['taxes'] as $t)
    <tr><td>{{ strtoupper($t['tax_code']) }} ({{ $t['category'] }})</td><td class="n">{{ $f($t['base_amount']) }}</td><td class="n">{{ \App\Modules\Invoicing\Support\MoneyFormat::rate($t['rate_pcm']) }}</td><td class="n">{{ $f($t['tax_amount']) }}</td></tr>
    @endforeach
    <tr><td colspan="3">Total HT</td><td class="n">{{ $f($s['amounts']['net']) }}</td></tr>
    <tr><td colspan="3">Total TVA</td><td class="n">{{ $f($s['amounts']['tax']) }}</td></tr>
    <tr class="total"><td colspan="3">Total TTC</td><td class="n">{{ $f($s['amounts']['gross']) }}</td></tr>
  </tbody>
</table>
<div class="mentions">
  @foreach ($s['mentions'] as $m)
  <p>{{ $m }}</p>
  @endforeach
</div>
@endsection
