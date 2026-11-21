Bonjour,

{!! $organisation !!} vous transmet {!! $avoir ? 'l\'avoir' : 'la facture' !!} {!! $numero !!}, jointe à ce message au format PDF.
@if (! $avoir && $echeance !== null)

Échéance de règlement : {!! $echeance !!}.
@endif

Cordialement,
{!! $organisation !!}
