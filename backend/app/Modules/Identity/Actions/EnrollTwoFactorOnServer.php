<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TwoFactorChangedNotification;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\RecoveryCode;
use SensitiveParameter;

final readonly class EnrollTwoFactorOnServer
{
    private const CODES_DE_SECOURS = 8;

    public function __construct(
        private TwoFactorAuthenticationProvider $provider,
        private RevokeUserCredentials $revocation,
        private RecordAudit $audit,
    ) {}

    /**
     * @param  array<string, string>  $contexte
     * @return list<string>
     */
    public function handle(User $user, #[SensitiveParameter] string $secret, #[SensitiveParameter] string $code, array $contexte = []): array
    {
        if (! $this->provider->verify($secret, $code)) {
            throw ErrorCode::OperatorProofInvalid->problem();
        }

        $codes = array_values(Collection::times(self::CODES_DE_SECOURS, fn (): string => RecoveryCode::generate())->all());

        DB::transaction(function () use ($user, $secret, $codes, $contexte): void {
            $compte = User::query()->lockForUpdate()->findOrFail($user->id);
            $remplace = $compte->hasConfirmedTwoFactor();

            $compte->forceFill([
                'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
                'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt((string) json_encode($codes)),
                'two_factor_confirmed_at' => now(),
            ])->save();

            $this->revocation->handle($compte, 'two_factor_enrolled_on_server');
            $this->audit->handle('auth.two_factor.enrolled_on_server', null, [...$contexte, 'replaced' => $remplace], $compte);

            DB::afterCommit(fn () => rescue(fn () => $compte->notify(new TwoFactorChangedNotification(true, $remplace))));
        });

        return $codes;
    }
}
