<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireTwoFactorProofForFactorManagement
{
    private const ROUTE_CONFIRMATION = 'two-factor.confirm';

    /**
     * Une fois la 2FA confirmée, lire ou changer le second facteur exige une preuve 2FA récente, jamais le seul mot de passe (ADR 0032).
     * L'activation initiale reste possible avec le mot de passe confirmé. Confirmer un code sur une 2FA déjà confirmée est refusé (409) :
     * Fortify y accepterait un code deviné sans compter les échecs et en tirerait une preuve 2FA.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || ! $user->hasConfirmedTwoFactor()) {
            return $next($request);
        }

        if ($request->boolean('force') || $request->route()?->getName() === self::ROUTE_CONFIRMATION) {
            throw ErrorCode::TwoFactorAlreadyEnabled->problem();
        }

        if (! EnsureRecentReauthentication::confirmedRecently($request, EnsureRecentReauthentication::CLE_2FA)) {
            throw ErrorCode::ReauthenticationRequired->problem();
        }

        return $next($request);
    }
}
