<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use App\Modules\Identity\Enums\SocialProvider;

final readonly class SocialProfileData
{
    private const APPLE_PRIVATE_RELAY = '@privaterelay.appleid.com';

    public function __construct(
        public SocialProvider $provider,
        public string $subject,
        public ?string $email,
        public bool $emailVerified,
        public ?string $name,
    ) {}

    public static function normalizeEmailVerified(mixed $valeur): bool
    {
        return $valeur === true || $valeur === 'true';
    }

    public function isApplePrivateRelay(): bool
    {
        return $this->email !== null && str_ends_with(strtolower($this->email), self::APPLE_PRIVATE_RELAY);
    }

    public function canLinkByEmail(): bool
    {
        return $this->email !== null && $this->emailVerified && ! $this->isApplePrivateRelay();
    }
}
