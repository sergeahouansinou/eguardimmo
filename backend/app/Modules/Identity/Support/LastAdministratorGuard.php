<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\OperatorRoleAssignment;

/**
 * Un opérateur ne retire jamais le dernier administrateur actif sans l'avoir demandé explicitement. À appeler dans la transaction
 * de l'appelant : les lignes d'administrateurs sont verrouillées le temps du contrôle.
 */
final class LastAdministratorGuard
{
    public static function assertAnotherAdministrator(string $userId): void
    {
        $autre = OperatorRoleAssignment::query()
            ->where('role', OperatorRole::Admin)
            ->whereIn('operator_id', fn ($q) => $q->select('id')->from('operators')->whereNull('revoked_at')->where('user_id', '<>', $userId))
            ->lockForUpdate()
            ->exists();

        if (! $autre) {
            throw ErrorCode::LastOperatorAdministrator->problem();
        }
    }
}
