<?php

declare(strict_types=1);

namespace App\Shared\Pdf;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Le PDF vient toujours d'un service Gotenberg : aucune génération de PDF en PHP. Technique, sans métier : l'appelant
 * donne son adresse et traduit un échec (`null`, déjà rapporté) en erreur de son module.
 */
final class GotenbergRenderer
{
    public function render(string $html, mixed $url, mixed $delai, string $variable): ?string
    {
        if (! is_string($url) || $url === '' || ! is_int($delai)) {
            report(new RuntimeException("Gotenberg non configuré : {$variable} est vide."));

            return null;
        }

        try {
            $reponse = Http::timeout($delai)
                ->attach('files', $html, 'index.html')
                ->post(rtrim($url, '/').'/forms/chromium/convert/html', ['paperWidth' => '8.27', 'paperHeight' => '11.7', 'printBackground' => 'true']);
        } catch (ConnectionException $erreur) {
            report($erreur);

            return null;
        }

        if (! $reponse->successful() || ! str_starts_with($reponse->body(), '%PDF')) {
            report(new RuntimeException("Gotenberg a répondu {$reponse->status()} sans PDF valide."));

            return null;
        }

        return $reponse->body();
    }
}
