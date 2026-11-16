<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Models\User;

final class RegistrationIntent
{
    public function of(string $userId): ?IntendedProfile
    {
        return User::query()->whereKey($userId)->first()?->intended_profile;
    }
}
