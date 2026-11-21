<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Les états des lieux et les remarques d'un locataire ne se mettent jamais en cache (ADR 0036, invariant 5).
 */
final class PrivateResponse
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $reponse = $next($request);
        $reponse->headers->set('Cache-Control', 'private, no-store');
        $reponse->headers->set('X-Content-Type-Options', 'nosniff');

        return $reponse;
    }
}
