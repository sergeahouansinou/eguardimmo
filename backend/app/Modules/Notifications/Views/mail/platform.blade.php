<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $objet }}</title>
</head>
<body style="margin:0;padding:16px;font-family:Arial,sans-serif;line-height:1.5">
{{-- HTML assaini par CampaignHtml avant enregistrement : l'échapper afficherait le code. --}}
{!! $corpsHtml !!}
<hr>
<p style="font-size:12px;color:#666666">Message envoyé par eGuardImmo.@if ($desinscription !== null) <a href="{{ $desinscription }}">Ne plus recevoir ces e-mails</a>@endif</p>
</body>
</html>
