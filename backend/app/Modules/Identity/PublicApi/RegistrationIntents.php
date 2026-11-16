<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Queries\RegistrationIntent;

final readonly class RegistrationIntents
{
    public function __construct(private RegistrationIntent $intentions) {}

    public function intendedProfile(string $userId): ?IntendedProfile
    {
        return $this->intentions->of($userId);
    }
}
