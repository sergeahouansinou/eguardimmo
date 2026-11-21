<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Le jeton d'invitation voyage dans le corps et dans l'adresse de la page : ni cache, ni en-tête Referer vers un tiers.
 */
final class PrivateInvitationResponse
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $reponse = $next($request);
        $reponse->headers->set('Cache-Control', 'no-store, private');
        $reponse->headers->set('Referrer-Policy', 'no-referrer');

        return $reponse;
    }
}
