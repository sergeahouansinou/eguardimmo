{{-- Texte brut : aucun HTML n'est produit, l'échappement HTML corromprait les apostrophes. --}}
{!! $corps !!}

--
{!! $nomOrganisation !!} vous écrit pour une information de gestion qui concerne votre location ou votre mandat. Ce message n'est pas une publicité.
@if ($piecesEnLien > 0 && $lienEspace !== null)

Les pièces jointes de ce message sont disponibles dans votre espace :
{{ $lienEspace }}
@endif

Pour répondre, utilisez la messagerie de votre espace.

@if ($desinscription !== null)
Vous ne souhaitez plus recevoir ces messages ? Désinscrivez-vous :
{{ $desinscription }}
@else
Envoi de test : ce message n'a pas été adressé à des destinataires.
@endif
