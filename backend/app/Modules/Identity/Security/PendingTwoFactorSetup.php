<?php

declare(strict_types=1);

namespace App\Modules\Identity\Security;

use App\Modules\Identity\Models\User;
use Illuminate\Contracts\Session\Session;

final class PendingTwoFactorSetup
{
    private const CLE = 'identity.two_factor_setup';

    public function remember(Session $session, User $user): void
    {
        $session->put(self::CLE, $this->empreinte($user));
    }

    public function forget(Session $session): void
    {
        $session->forget(self::CLE);
    }

    public function ownedBy(Session $session, User $user): bool
    {
        $empreinte = $session->get(self::CLE);

        return $user->two_factor_secret !== null && is_string($empreinte) && hash_equals($empreinte, $this->empreinte($user));
    }

    private function empreinte(User $user): string
    {
        return hash('sha256', (string) $user->two_factor_secret);
    }
}
