<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\MobileLoginResult;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\TwoFactorChallenges;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class StartMobileSession
{
    public function __construct(
        private IssueMobileToken $jetons,
        private TwoFactorChallenges $defis,
        private RecordAudit $audit,
    ) {}

    public function handle(User $user, string $nomAppareil): MobileLoginResult
    {
        return DB::transaction(function () use ($user, $nomAppareil): MobileLoginResult {
            $compte = User::query()->lockForUpdate()->findOrFail($user->id);

            if ($compte->hasConfirmedTwoFactor()) {
                $this->audit->handle('auth.two_factor.challenged', $compte->id, ['channel' => 'mobile']);

                return MobileLoginResult::challenge($this->defis->create($compte->id, $nomAppareil));
            }

            return MobileLoginResult::token($this->jetons->handle($compte, $nomAppareil));
        });
    }
}
