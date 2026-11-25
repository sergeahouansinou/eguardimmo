<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\Cache;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;
use SensitiveParameter;

final readonly class VerifyTwoFactorCode
{
    private const ANTI_REJEU_TOTP_SECONDES = 150;

    private const PREFIXE_CLE_SESSION = 'session-proof:';

    public function __construct(
        private TwoFactorAuthenticationProvider $provider,
        private RecordAudit $audit,
        private AccountLockout $lockout,
    ) {}

    /**
     * `$enSession` : preuve d'une session déjà authentifiée (preuve web et preuve opérateur). Un seul verrou par compte, sur son identifiant,
     * ne compte que les échecs de preuve, jamais les échecs de mot de passe d'un anonyme, qui alimentent le verrou par e-mail réservé aux connexions.
     */
    public function handle(User $user, #[SensitiveParameter] ?string $code, #[SensitiveParameter] ?string $codeDeSecours, bool $enSession = false): bool
    {
        if (! $user->hasConfirmedTwoFactor()) {
            return false;
        }

        $cle = $enSession ? self::PREFIXE_CLE_SESSION.$user->id : $user->email;
        $this->lockout->ensureNotLocked($cle);

        if ($codeDeSecours !== null && $codeDeSecours !== '') {
            return $this->consommerCodeDeSecours($user, $codeDeSecours, $cle);
        }

        $secret = Fortify::currentEncrypter()->decrypt((string) $user->two_factor_secret);
        $valide = $code !== null && $code !== '' && is_string($secret) && $this->provider->verify($secret, $code)
            && Cache::add('identity:totp-utilise:'.$user->id.':'.hash('sha256', $code), true, self::ANTI_REJEU_TOTP_SECONDES);

        if (! $valide) {
            $this->echec($user, [], $cle);
        }

        return $valide;
    }

    private function consommerCodeDeSecours(User $user, string $codeDeSecours, string $cle): bool
    {
        return (bool) Cache::lock('identity:recovery-codes:'.$user->id, 10)
            ->block(5, fn (): bool => $this->remplacerSiValide($user->refresh(), $codeDeSecours, $cle));
    }

    private function remplacerSiValide(User $user, string $codeDeSecours, string $cle): bool
    {
        $codes = $user->recoveryCodes();
        $trouve = collect($codes)->first(fn (mixed $c): bool => is_string($c) && hash_equals($c, $codeDeSecours));

        if (! is_string($trouve)) {
            $this->echec($user, ['recovery' => true], $cle);

            return false;
        }

        $user->replaceRecoveryCode($trouve);

        return true;
    }

    /**
     * @param  array<string, mixed>  $contexte
     */
    private function echec(User $user, array $contexte, string $cle): void
    {
        $this->lockout->recordFailure($cle);
        $this->audit->handle('auth.two_factor.failed', $user->id, $contexte);
    }
}
