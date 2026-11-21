<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureWebSession
{
    /**
     * Phase 1 de l'espace propriétaire : une écriture n'est permise qu'à la session web, jamais à un jeton personnel (mobile, ADR 0032 § 5).
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->currentAccessToken() instanceof PersonalAccessToken) {
            throw ErrorCode::ReauthenticationRequired->problem();
        }

        return $next($request);
    }
}
