@php($f = fn (int $m): string => \App\Modules\Recovery\Support\MoneyFormat::fr($m, $s['currency']))
@php($d = fn (string $iso): string => \Carbon\CarbonImmutable::parse($iso)->format('d/m/Y'))
@extends('recovery::layout')
@section('titre', 'Extrait du compte du bail '.$s['lease']['reference'])
@section('corps')
<h1>Extrait du grand livre</h1>
<div class="meta">
  <div><strong>{{ $s['issuer']['name'] }}</strong><br>Bail {{ $s['lease']['reference'] }}</div>
  <div>Dossier {{ $s['case']['number'] }}<br>Du {{ $d($s['from']) }} au {{ $d($s['to']) }}</div>
</div>
<table>
  <thead><tr><th>Date</th><th>Pièce</th><th>Libellé</th><th class="n">Débit</th><th class="n">Crédit</th><th class="n">Solde</th></tr></thead>
  <tbody>
    <tr><td colspan="5">Solde d'ouverture</td><td class="n">{{ $f($s['opening']) }}</td></tr>
  @foreach ($s['lines'] as $ligne)
    <tr>
      <td>{{ $d($ligne['date']) }}</td><td>{{ $ligne['reference'] }}</td><td>{{ $ligne['label'] }}</td>
      <td class="n">{{ $ligne['debit'] > 0 ? $f($ligne['debit']) : '' }}</td>
      <td class="n">{{ $ligne['credit'] > 0 ? $f($ligne['credit']) : '' }}</td>
      <td class="n">{{ $f($ligne['balance']) }}</td>
    </tr>
  @endforeach
    <tr class="total"><td colspan="5">Solde de clôture</td><td class="n">{{ $f($s['closing']) }}</td></tr>
  </tbody>
</table>
@endsection
