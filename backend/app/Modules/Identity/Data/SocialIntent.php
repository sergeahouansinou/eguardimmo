<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Enums\SocialIntentType;

final readonly class SocialIntent
{
    private function __construct(
        public SocialIntentType $type,
        public ?IntendedProfile $profile,
        public ?string $userId,
    ) {}

    public static function login(): self
    {
        return new self(SocialIntentType::Login, null, null);
    }

    public static function register(IntendedProfile $profile): self
    {
        return new self(SocialIntentType::Register, $profile, null);
    }

    public static function link(string $userId): self
    {
        return new self(SocialIntentType::Link, null, $userId);
    }
}
