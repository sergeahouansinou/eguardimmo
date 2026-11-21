<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Chiffres financiers : jamais mis en cache par un navigateur ou un intermédiaire, erreurs comprises.
 */
final class PrivateResponse
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $reponse = $next($request);
        $reponse->headers->set('Cache-Control', 'no-store, private');
        $reponse->headers->set('X-Content-Type-Options', 'nosniff');

        return $reponse;
    }
}
