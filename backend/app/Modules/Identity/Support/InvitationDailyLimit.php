<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Enums\ErrorCode;

/**
 * Chaque invitation envoie un e-mail sous le nom de la plateforme : une organisation, ou un compte d'agence détourné, ne peut
 * pas l'utiliser comme relais. Le compte porte sur les vingt-quatre dernières heures, remplacements et invitations révoquées compris.
 */
final class InvitationDailyLimit
{
    public const string OWNER = 'identity.owner_invitation_daily_max';

    public const string TENANT = 'identity.tenant_invitation_daily_max';

    public static function assertBelow(string $cleDeConfiguration, int $emises): void
    {
        $max = config($cleDeConfiguration);

        if ($emises >= (is_int($max) && $max > 0 ? $max : 100)) {
            throw ErrorCode::InvitationDailyLimitReached->problem();
        }
    }
}
