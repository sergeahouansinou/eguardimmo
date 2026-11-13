<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\MobileLoginResult;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\TwoFactorChallenges;
use App\Shared\Audit\RecordAudit;

final readonly class StartMobileSession
{
    public function __construct(
        private IssueMobileToken $jetons,
        private TwoFactorChallenges $defis,
        private RecordAudit $audit,
    ) {}

    public function handle(User $user, string $nomAppareil): MobileLoginResult
    {
        if ($user->hasConfirmedTwoFactor()) {
            $this->audit->handle('auth.two_factor.challenged', $user->id, ['channel' => 'mobile']);

            return MobileLoginResult::challenge($this->defis->create($user->id, $nomAppareil));
        }

        return MobileLoginResult::token($this->jetons->handle($user, $nomAppareil));
    }
}
