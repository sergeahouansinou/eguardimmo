<?php

declare(strict_types=1);

namespace App\Modules\Identity\Security;

use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class AccountLockout
{
    public const ECHECS_MAX_PAR_HEURE = 10;

    private const PREMIER_VERROU_SECONDES = 15 * 60;

    private const VERROU_MAX_SECONDES = 24 * 3600;

    public function ensureNotLocked(string $email): void
    {
        $jusqua = Cache::get($this->cle('verrou', $email));

        if (is_int($jusqua) && $jusqua > now()->getTimestamp()) {
            throw new ThrottleRequestsException('Trop de tentatives. Réessayez plus tard.', headers: [
                'Retry-After' => (string) ($jusqua - now()->getTimestamp()),
            ]);
        }
    }

    public function recordFailure(string $email): void
    {
        $cleEchecs = $this->cle('echecs', $email);
        Cache::add($cleEchecs, 0, 3600);
        $echecs = (int) Cache::increment($cleEchecs);

        if ($echecs < self::ECHECS_MAX_PAR_HEURE) {
            return;
        }

        $cleVerrous = $this->cle('verrous', $email);
        Cache::add($cleVerrous, 0, self::VERROU_MAX_SECONDES);
        $verrous = (int) Cache::increment($cleVerrous);

        $duree = min(self::PREMIER_VERROU_SECONDES << min(max($verrous - 1, 0), 16), self::VERROU_MAX_SECONDES);
        Cache::put($this->cle('verrou', $email), now()->getTimestamp() + $duree, $duree);
        Cache::forget($cleEchecs);
    }

    public function clear(string $email): void
    {
        Cache::forget($this->cle('echecs', $email));
    }

    private function cle(string $type, string $email): string
    {
        return 'identity:lockout:'.$type.':'.hash('sha256', Str::lower(trim($email)));
    }
}
