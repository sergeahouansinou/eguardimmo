<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class AssignRequestId
{
    public const ATTRIBUT = 'request_id';

    public const ENTETE = 'X-Request-Id';

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $recu = $request->headers->get(self::ENTETE);
        $identifiant = is_string($recu) && Str::isUuid($recu) ? strtolower($recu) : (string) Str::uuid7();

        $request->attributes->set(self::ATTRIBUT, $identifiant);
        Log::shareContext(['request_id' => $identifiant]);

        $reponse = $next($request);
        $reponse->headers->set(self::ENTETE, $identifiant);

        return $reponse;
    }
}
