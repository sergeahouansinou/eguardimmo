<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Middleware;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\ErrorCode;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Double authentification exigée pour tout rôle, y compris comptable, sur les routes qui déplacent des fonds de tiers.
 * À placer après le middleware `organization`.
 */
final readonly class RequireConfirmedTwoFactor
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $utilisateur = $request->user();

        if (! $utilisateur instanceof User) {
            throw new AuthenticationException;
        }

        if (! $utilisateur->hasConfirmedTwoFactor()) {
            throw ErrorCode::TwoFactorRequired->problem();
        }

        return $next($request);
    }
}
