<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use App\Modules\Identity\Enums\IntendedProfile;
use SensitiveParameter;

final readonly class RegistrationData
{
    public function __construct(
        public string $name,
        public string $email,
        #[SensitiveParameter] public string $password,
        public IntendedProfile $intendedProfile,
    ) {}
}
