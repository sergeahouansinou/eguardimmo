Bonjour,

@if ($urgence)
{!! $organisation !!} a engagé en urgence l'intervention {!! $reference !!} ({!! $nature !!}) sur votre bien, sans attendre votre accord.@if ($montant !== null) Montant : {!! $montant !!}.@endif
@else
{!! $organisation !!} soumet à votre accord l'intervention {!! $reference !!} ({!! $nature !!}). Montant TTC : {!! $montant !!}.
@if ($echeance !== null)
Réponse attendue avant le {!! $echeance !!}.
@endif
Sans réponse de votre part, l'intervention ne sera pas engagée.
@endif

Contactez {!! $organisation !!} pour toute question.
