@php($d = fn (?string $iso): string => $iso === null ? '—' : \Carbon\CarbonImmutable::parse($iso)->format('d/m/Y'))
@extends('recovery::layout')
@section('titre', 'Bail '.$s['lease']['reference'])
@section('corps')
<h1>Fiche du bail</h1>
<div class="meta">
  <div><strong>{{ $s['issuer']['name'] }}</strong></div>
  <div>Dossier {{ $s['case']['number'] }}<br>Établie le {{ $d($s['generated_on']) }}</div>
</div>
<div class="bloc">
  <strong>Référence</strong> : {{ $s['lease']['reference'] }}<br>
  <strong>Statut</strong> : {{ $s['lease']['status'] }}<br>
  <strong>Juridiction</strong> : {{ $s['lease']['jurisdiction'] }}<br>
  <strong>Début</strong> : {{ $d($s['lease']['starts_on']) }} — <strong>Fin</strong> : {{ $d($s['lease']['ends_on']) }}<br>
  <strong>Signé le</strong> : {{ $d($s['lease']['signed_on']) }}<br>
  <strong>Jour d'échéance</strong> : {{ $s['lease']['due_day'] }} — <strong>Périodicité</strong> : {{ $s['lease']['periodicity'] }}
</div>
<table>
  <thead><tr><th>Partie</th><th>Rôle</th><th>Du</th><th>Au</th></tr></thead>
  <tbody>
  @foreach ($s['parties'] as $partie)
    <tr><td>{{ $partie['name'] }}</td><td>{{ $partie['role'] }}{{ $partie['joint_liability'] ? ' (solidaire)' : '' }}</td><td>{{ $d($partie['valid_from']) }}</td><td>{{ $d($partie['valid_to']) }}</td></tr>
  @endforeach
  </tbody>
</table>
@endsection
