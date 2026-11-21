<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Data\ReauthenticationData;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use Illuminate\Http\Request;

/**
 * Preuves de réauthentification portées par une requête : confirmations récentes de la session et champs du corps.
 */
final class ReauthenticationProof
{
    public static function fromRequest(Request $requete): ReauthenticationData
    {
        $texte = fn (string $cle): ?string => $requete->filled($cle) ? (string) $requete->string($cle) : null;

        return new ReauthenticationData(
            recentPasswordConfirmation: EnsureRecentReauthentication::confirmedRecently($requete, EnsureRecentReauthentication::CLE_MOT_DE_PASSE),
            recentTwoFactorConfirmation: EnsureRecentReauthentication::confirmedRecently($requete, EnsureRecentReauthentication::CLE_2FA),
            password: $texte('password'),
            code: $texte('code'),
            recoveryCode: $texte('recovery_code'),
            provider: $requete->filled('provider') ? SocialProvider::from((string) $requete->string('provider')) : null,
            idToken: $texte('id_token'),
            nonce: $texte('nonce'),
        );
    }
}
