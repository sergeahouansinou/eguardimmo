<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use Illuminate\Http\Response;

final class UnsubscribePage
{
    /**
     * @param  array{sender: string, platform: bool}  $expediteur
     */
    public static function render(string $etat, array $expediteur = ['sender' => '', 'platform' => false], int $statut = 200): Response
    {
        $reponse = response()->view('notifications::unsubscribe', ['etat' => $etat, 'organisation' => $expediteur['sender'], 'plateforme' => $expediteur['platform']], $statut);
        $reponse->headers->add(['Cache-Control' => 'no-store, private', 'Referrer-Policy' => 'no-referrer', 'X-Frame-Options' => 'DENY']);

        return $reponse;
    }
}
