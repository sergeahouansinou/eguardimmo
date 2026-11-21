<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Guest;

use App\Modules\Recovery\Actions\DownloadByToken;
use App\Shared\Http\ConsoleRelay;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class DownloadByTokenController
{
    public function __invoke(#[\SensitiveParameter] string $token, Request $request, DownloadByToken $telechargement): Response
    {
        if ($request->isMethod('HEAD')) {
            $telechargement->probe($token);
            $reponse = new Response('', 200, ['Content-Type' => 'application/zip', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
        } else {
            $reponse = $telechargement->handle($token, (string) ConsoleRelay::ipClient($request));
        }

        $reponse->headers->set('Referrer-Policy', 'no-referrer');
        $reponse->headers->set('X-Robots-Tag', 'noindex, nofollow');

        return $reponse;
    }
}
