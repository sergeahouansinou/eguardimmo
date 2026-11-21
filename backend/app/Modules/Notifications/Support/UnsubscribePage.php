<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use Illuminate\Http\Response;

final class UnsubscribePage
{
    public static function render(string $etat, string $organisation, int $statut = 200): Response
    {
        $reponse = response()->view('notifications::unsubscribe', ['etat' => $etat, 'organisation' => $organisation], $statut);
        $reponse->headers->add(['Cache-Control' => 'no-store, private', 'Referrer-Policy' => 'no-referrer', 'X-Frame-Options' => 'DENY']);

        return $reponse;
    }
}
