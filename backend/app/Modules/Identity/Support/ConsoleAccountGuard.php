<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;

/**
 * Une action de la console ne vise ni un compte supprimé (lisible, jamais modifiable) ni un compte opérateur (artisan seulement).
 */
final class ConsoleAccountGuard
{
    public static function assertActionable(User $compte): void
    {
        if ($compte->trashed()) {
            throw ErrorCode::AccountNotFound->problem();
        }

        if ($compte->isActiveOperator()) {
            throw ErrorCode::OperatorAccountProtected->problem();
        }
    }
}
