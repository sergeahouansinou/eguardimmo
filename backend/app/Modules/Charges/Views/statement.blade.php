@php($f = fn (int $m): string => \App\Modules\Charges\Support\MoneyFormat::fr($m, $s['currency']))
@php($d = fn (string $iso): string => \Carbon\CarbonImmutable::parse($iso)->format('d/m/Y'))
@extends('charges::layout')
@section('titre', 'Décompte de charges '.$s['number'])
@section('corps')
<h1>Décompte de régularisation des charges</h1>
<div class="meta">
  <div><strong>{{ $s['issuer']['name'] }}</strong></div>
  <div>N° {{ $s['number'] }}<br>Émis le {{ $d($s['issued_on']) }}</div>
</div>
<div class="bloc">
  <strong>Locataire{{ count($s['tenants']) > 1 ? 's' : '' }}</strong> : {{ implode(', ', array_column($s['tenants'], 'name')) }}<br>
  <strong>Bail</strong> : {{ $s['lease']['reference'] }}<br>
  <strong>Logement</strong> : {{ $s['unit']['property_name'] }} — {{ $s['unit']['reference'] }}, {{ $s['unit']['address']['line1'] }}, {{ $s['unit']['address']['postal_code'] }} {{ $s['unit']['address']['city'] }}<br>
  <strong>Période</strong> : du {{ $d($s['period']['start']) }} au {{ $d($s['period']['last_day']) }} ({{ $s['period']['occupied_days'] }} jours d'occupation)
  @if ($s['supersedes_number'])
  <br><strong>Rectifie le décompte</strong> {{ $s['supersedes_number'] }}@if ($s['rectification_reason']) : {{ $s['rectification_reason'] }}@endif
  @endif
</div>
<table>
  <thead><tr><th>Poste</th><th>Répartition</th><th class="n">Total de l'immeuble</th><th class="n">Votre part</th></tr></thead>
  <tbody>
  @foreach ($s['lines'] as $ligne)
    <tr><td>{{ $ligne['label'] }}</td><td>{{ $ligne['split_label'] }} · {{ $ligne['days'] }} j</td><td class="n">{{ $f($ligne['item_amount']) }}</td><td class="n">{{ $f($ligne['share']) }}</td></tr>
  @endforeach
    <tr class="total"><td colspan="3">Total des charges récupérables</td><td class="n">{{ $f($s['totals']['share']) }}</td></tr>
    <tr><td colspan="3">Provisions appelées sur la période</td><td class="n">{{ $f($s['totals']['provisions_called']) }}</td></tr>
    @if ($s['totals']['provisions_unpaid'] > 0)
    <tr><td colspan="3">dont non réglé</td><td class="n">{{ $f($s['totals']['provisions_unpaid']) }}</td></tr>
    @endif
    <tr class="total"><td colspan="3">{{ $s['totals']['balance'] >= 0 ? 'Solde à payer' : 'Solde en votre faveur' }}</td><td class="n">{{ $f(abs($s['totals']['balance'])) }}</td></tr>
  </tbody>
</table>
@if ($s['totals']['suggested_monthly_provision'] > 0)
<p>Provision mensuelle suggérée pour la période à venir : {{ $f($s['totals']['suggested_monthly_provision']) }}.</p>
@endif
@if ($s['settlement'] === 'next_installments' && $s['not_before'])
<p>Le solde sera ajouté à votre prochain avis d'échéance à partir du {{ $d($s['not_before']) }}.</p>
@endif
@foreach ($s['mentions'] as $mention)
<p class="mention">{{ $mention }}</p>
@endforeach
@endsection
