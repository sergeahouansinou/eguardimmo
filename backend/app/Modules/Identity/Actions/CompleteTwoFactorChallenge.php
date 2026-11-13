<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\TwoFactorChallenges;
use Illuminate\Support\Facades\Cache;
use SensitiveParameter;

final readonly class CompleteTwoFactorChallenge
{
    public function __construct(
        private TwoFactorChallenges $defis,
        private VerifyTwoFactorCode $verification,
        private IssueMobileToken $jetons,
    ) {}

    public function handle(#[SensitiveParameter] string $challenge, #[SensitiveParameter] ?string $code, #[SensitiveParameter] ?string $codeDeSecours): ?string
    {
        $resultat = Cache::lock('identity:2fa-challenge-lock:'.hash('sha256', $challenge), 10)
            ->block(5, function () use ($challenge, $code, $codeDeSecours): ?string {
                $defi = $this->defis->find($challenge);
                $user = $defi !== null ? User::query()->find($defi['user_id']) : null;

                if ($defi === null || $user === null) {
                    return null;
                }

                if (! $this->verification->handle($user, $code, $codeDeSecours)) {
                    $this->defis->recordFailure($challenge);

                    return null;
                }

                if (! $this->defis->consume($challenge)) {
                    return null;
                }

                return $this->jetons->handle($user, $defi['device_name']);
            });

        return is_string($resultat) ? $resultat : null;
    }
}
