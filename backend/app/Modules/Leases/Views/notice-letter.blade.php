<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Congé du locataire</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  body { font: 11pt/1.5 Helvetica, Arial, sans-serif; color: #14202A; }
  .expediteur, .destinataire { margin-bottom: 8mm; }
  .destinataire { text-align: right; }
  h1 { font-size: 14pt; margin: 10mm 0 6mm; }
  .mention { margin-top: 14mm; font-size: 8.5pt; color: #5F7176; }
</style>
</head>
<body>
<div class="expediteur">
  <strong>{{ $s['tenant_name'] }}</strong><br>
  {{ $s['housing_address'] }}
</div>
<div class="destinataire">
  <strong>{{ $s['agency_name'] }}</strong>
</div>
<p>Fait le {{ $s['letter_date'] }}</p>
<h1>Objet : congé du logement{{ $s['lease_reference'] !== null ? ' (bail '.$s['lease_reference'].')' : '' }}</h1>
<p>Madame, Monsieur,</p>
<p>Par la présente, je vous informe de ma décision de quitter le logement situé {{ $s['housing_address'] }}.</p>
<p>Motif du préavis invoqué : {{ $s['reason_label'] }}.@if ($s['proof_attached']) Le justificatif de ce motif est joint à ma demande.@endif</p>
<p>Je souhaite quitter les lieux le {{ $s['requested_departure_on'] }}. Le préavis court à compter de la réception de la présente ; la date de fin de préavis la plus proche est calculée à partir de cette réception.</p>
<p>Je vous remercie d'accuser réception de ce congé et de me proposer une date d'état des lieux de sortie.</p>
<p>Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
<p>{{ $s['tenant_name'] }}</p>
<p class="mention">Document généré depuis l'espace locataire. Version du consentement : {{ $s['consent_version'] }}. Ce document ne vaut congé que s'il est remis ou reçu dans les formes légales.</p>
</body>
</html>
