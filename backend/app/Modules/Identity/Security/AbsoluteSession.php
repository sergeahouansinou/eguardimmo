<?php

declare(strict_types=1);

namespace App\Modules\Identity\Security;

use App\Modules\Identity\Models\User;
use Illuminate\Contracts\Session\Session;

final class AbsoluteSession
{
    public const CLE = 'identity.session_expires_at';

    public function start(Session $session, User $user): void
    {
        $minutes = $user->isActiveOperator()
            ? config('identity.operator_session_absolute_minutes')
            : config('identity.session_absolute_minutes');

        $session->put(self::CLE, now()->addMinutes(is_int($minutes) ? $minutes : 60)->getTimestamp());
    }

    public function expired(Session $session): bool
    {
        $echeance = $session->get(self::CLE);

        return is_int($echeance) && $echeance <= now()->getTimestamp();
    }
}
