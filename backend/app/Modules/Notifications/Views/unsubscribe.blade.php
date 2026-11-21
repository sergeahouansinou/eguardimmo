<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Désinscription</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5}button{font:inherit;padding:.6rem 1.2rem}</style>
</head>
<body>
@if ($etat === 'confirm')
<h1>Ne plus recevoir ces messages</h1>
<p>Vous ne recevrez plus les diffusions d'information de {{ $organisation }}. Les messages liés à votre bail ou à votre mandat dans votre espace ne sont pas concernés.</p>
<form method="post" action="">
<button type="submit">Me désinscrire</button>
</form>
@elseif ($etat === 'done')
<h1>Désinscription enregistrée</h1>
<p>Vous ne recevrez plus les diffusions d'information de {{ $organisation }}.</p>
@else
<h1>Lien invalide</h1>
<p>Ce lien de désinscription est invalide ou expiré.</p>
@endif
</body>
</html>
