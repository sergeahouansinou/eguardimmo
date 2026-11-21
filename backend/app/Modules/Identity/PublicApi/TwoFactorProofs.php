<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Data\TwoFactorProofData;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * Preuve 2FA récente de la session courante, pour figer la méthode et l'heure dans une preuve de décision (ADR 0032). Le mot de
 * passe ne vaut jamais ici ; une session sans méthode connue n'a pas de preuve.
 */
final readonly class TwoFactorProofs
{
    public function recent(Request $request): ?TwoFactorProofData
    {
        if (! EnsureRecentReauthentication::confirmedRecently($request, EnsureRecentReauthentication::CLE_2FA)) {
            return null;
        }

        $methode = $request->session()->get(EnsureRecentReauthentication::CLE_METHODE_2FA);

        if (! in_array($methode, [EnsureRecentReauthentication::METHODE_TOTP, EnsureRecentReauthentication::METHODE_SECOURS], true)) {
            return null;
        }

        return new TwoFactorProofData((string) $methode, CarbonImmutable::createFromTimestamp((int) $request->session()->get(EnsureRecentReauthentication::CLE_2FA)));
    }
}
