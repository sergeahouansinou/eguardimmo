<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use Illuminate\Http\Request;

/**
 * Méthode par laquelle la session courante a prouvé sa présence récemment, pour la figer dans un journal de preuve :
 * `totp`, `recovery_code` ou `password` ; null sans preuve récente.
 */
final readonly class ReauthenticationMethods
{
    public function of(Request $request): ?string
    {
        if (EnsureRecentReauthentication::confirmedRecently($request, EnsureRecentReauthentication::CLE_2FA)) {
            $methode = $request->session()->get(EnsureRecentReauthentication::CLE_METHODE_2FA);

            return in_array($methode, [EnsureRecentReauthentication::METHODE_TOTP, EnsureRecentReauthentication::METHODE_SECOURS], true) ? (string) $methode : 'two_factor';
        }

        return EnsureRecentReauthentication::confirmedRecently($request, EnsureRecentReauthentication::CLE_MOT_DE_PASSE) ? 'password' : null;
    }
}
