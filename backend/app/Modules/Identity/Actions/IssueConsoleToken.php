<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\LoginChannel;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use SensitiveParameter;

final readonly class IssueConsoleToken
{
    public const CAPACITE = 'operator';

    public function __construct(
        private AttemptPasswordLogin $connexion,
        private VerifyTwoFactorCode $verification,
        private AccountLockout $lockout,
        private RecordAudit $audit,
        private RecordSuccessfulLogin $derniereConnexion,
    ) {}

    public function handle(
        string $email,
        #[SensitiveParameter] string $password,
        #[SensitiveParameter] ?string $code,
        #[SensitiveParameter] ?string $codeDeSecours,
    ): ?string {
        $user = $this->connexion->handle($email, $password, LoginChannel::Console);

        if ($user === null) {
            return null;
        }

        return DB::transaction(function () use ($user, $code, $codeDeSecours): ?string {
            $compte = User::query()->lockForUpdate()->find($user->id);

            if ($compte === null || ! $compte->isActiveOperator()) {
                $this->lockout->recordFailure($user->email);
                $this->audit->handle('auth.console.denied', $user->id);

                return null;
            }

            if (! $this->verification->handle($compte, $code, $codeDeSecours)) {
                $this->audit->handle('auth.console.denied', $compte->id);

                return null;
            }

            $minutes = config('identity.console_token_ttl_minutes');
            $jeton = $compte->createToken('console', [self::CAPACITE], now()->addMinutes(is_int($minutes) ? $minutes : 240));

            $this->derniereConnexion->handle($compte);
            $this->audit->handle('auth.token.issued', $compte->id, ['channel' => 'console', 'token_id' => $jeton->accessToken->id]);

            return $jeton->plainTextToken;
        });
    }
}
