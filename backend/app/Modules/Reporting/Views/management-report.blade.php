@extends('reporting::layout')
@php
    $devise = (string) $s['currency'];
    $m = fn (int $montant): string => \App\Modules\Reporting\Support\MoneyText::format($montant, $devise);
    $f = $s['figures'];
    $sections = $s['sections'];
    $par = collect($s['lines'])->groupBy('kind');
    $adresse = fn (?array $a): string => $a === null ? '' : trim(implode(', ', array_filter([$a['line1'] ?? null, $a['line2'] ?? null, trim(($a['postal_code'] ?? '').' '.($a['city'] ?? ''))])));
    $jour = fn (string $d): string => \Carbon\CarbonImmutable::parse($d)->format('d/m/Y');
@endphp
@section('titre', 'Compte rendu de gestion '.($s['number'] ?? ''))
@section('corps')
@if ($apercu)
<div class="filigrane">PROJET</div>
@endif
<div class="entete">
  <div>
    <strong>{{ $s['issuer']['legal_name'] }}</strong><br>
    {{ $adresse($s['issuer']['address'] ?? null) }}<br>
    @if (! empty($s['issuer']['siren'])) SIREN {{ $s['issuer']['siren'] }}<br>@endif
    @if (! empty($s['issuer']['professional_card_number'])) Carte professionnelle {{ $s['issuer']['professional_card_number'] }}<br>@endif
    @if (! empty($s['issuer']['guarantee_provider'])) Garant : {{ $s['issuer']['guarantee_provider'] }}@endif
  </div>
  <div>
    <strong>Mandant</strong><br>
    {{ $s['mandant']['name'] }}<br>
    {{ $adresse($s['mandant']['address'] ?? null) }}<br>
    @if (! empty($s['mandant']['payout_account_last4'])) Compte de reversement se terminant par {{ $s['mandant']['payout_account_last4'] }} @endif
  </div>
</div>
<h1>Compte rendu de gestion</h1>
<div class="bloc">
  @if (! empty($s['number'])) N° {{ $s['number'] }} &middot; @endif
  Période du {{ $jour($s['period']['from']) }} au {{ $jour($s['period']['to']) }}
  @if (! empty($s['rectifies_number'])) &middot; rectifie le compte rendu {{ $s['rectifies_number'] }} ({{ $s['rectification_reason'] }}) @endif
</div>

<h2>Synthèse du compte du mandant</h2>
<table>
  <tr><td>Solde d'ouverture</td><td class="n">{{ $m($f['opening_balance']) }}</td></tr>
  <tr><td>Loyers et sommes encaissés</td><td class="n">{{ $m($f['collected_total']) }}</td></tr>
  <tr><td>Honoraires de gestion (TVA incluse)</td><td class="n">-{{ $m($f['fees_total']) }}</td></tr>
  <tr><td>Travaux et factures payées pour le compte du mandant</td><td class="n">-{{ $m($f['works_total']) }}</td></tr>
  <tr><td>Reversements au mandant</td><td class="n">-{{ $m($f['payout_total']) }}</td></tr>
  @if ($f['adjustments_total'] !== 0) <tr><td>Régularisations</td><td class="n">{{ $m($f['adjustments_total']) }}</td></tr> @endif
  <tr class="total"><td>Solde de clôture</td><td class="n">{{ $m($f['closing_balance']) }}</td></tr>
</table>

@php
    $blocs = [
        'rent' => [['rent_called', 'Loyers appelés'], ['rent_collected', 'Loyers encaissés'], ['advance', 'Encaissements d\'avance']],
        'fees' => [['fee', 'Honoraires'], ['fee_vat', 'TVA sur honoraires']],
        'works' => [['works', 'Travaux']],
        'payout' => [['payout', 'Reversements']],
        'arrears' => [['arrears', 'Impayés à la fin de la période']],
    ];
@endphp
@foreach ($blocs as $section => $groupes)
  @if (in_array($section, $sections, true))
    @foreach ($groupes as [$kind, $titre])
      @php($lignes = $par->get($kind, collect()))
      @if ($lignes->isNotEmpty())
      <h2>{{ $titre }}</h2>
      <table>
        <tr><th>Date</th><th>Libellé</th><th class="n">Montant</th></tr>
        @foreach ($lignes as $l)
          <tr><td>{{ $jour($l['date']) }}</td><td>{{ $l['label'] }}@if ($kind === 'works' && isset($s['work_references'][$l['source_id']])) ({{ $s['work_references'][$l['source_id']] }}) @endif</td><td class="n">{{ $m($l['amount']) }}</td></tr>
        @endforeach
      </table>
      @endif
    @endforeach
  @endif
@endforeach

@if (in_array('receipts', $sections, true) && ! empty($s['receipts']))
  <h2>Quittances émises</h2>
  <table>
    <tr><th>Numéro</th><th>Date</th></tr>
    @foreach ($s['receipts'] as $q)
      <tr><td>{{ $q['number'] }}</td><td>{{ $jour($q['issued_on']) }}</td></tr>
    @endforeach
  </table>
@endif

<div class="mention">
  @foreach ($s['mentions'] as $mention) <p>{{ $mention }}</p> @endforeach
</div>
@endsection
