<?php

declare(strict_types=1);

namespace App\Modules\Identity\Security;

use Illuminate\Support\Facades\Cache;
use SensitiveParameter;

final class TwoFactorChallenges
{
    public const DUREE_SECONDES = 300;

    public const ESSAIS_MAX = 5;

    public function create(string $userId, string $deviceName): string
    {
        $challenge = bin2hex(random_bytes(32));

        Cache::put($this->cle($challenge), ['user_id' => $userId, 'device_name' => $deviceName], self::DUREE_SECONDES);
        Cache::put($this->cle($challenge).':essais', 0, self::DUREE_SECONDES);

        return $challenge;
    }

    /**
     * @return array{user_id: string, device_name: string}|null
     */
    public function find(#[SensitiveParameter] string $challenge): ?array
    {
        $donnees = Cache::get($this->cle($challenge));

        if (! is_array($donnees) || ! is_string($donnees['user_id'] ?? null) || ! is_string($donnees['device_name'] ?? null)) {
            return null;
        }

        return ['user_id' => $donnees['user_id'], 'device_name' => $donnees['device_name']];
    }

    public function consume(#[SensitiveParameter] string $challenge): bool
    {
        $consomme = Cache::pull($this->cle($challenge)) !== null;
        Cache::forget($this->cle($challenge).':essais');

        return $consomme;
    }

    public function recordFailure(#[SensitiveParameter] string $challenge): void
    {
        $essais = (int) Cache::increment($this->cle($challenge).':essais');

        if ($essais >= self::ESSAIS_MAX) {
            $this->consume($challenge);
        }
    }

    private function cle(string $challenge): string
    {
        return 'identity:2fa-challenge:'.hash('sha256', $challenge);
    }
}
