<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use SensitiveParameter;

final readonly class MobileLoginResult
{
    private function __construct(
        #[SensitiveParameter] public ?string $token,
        #[SensitiveParameter] public ?string $challenge,
    ) {}

    public static function token(#[SensitiveParameter] string $token): self
    {
        return new self($token, null);
    }

    public static function challenge(#[SensitiveParameter] string $challenge): self
    {
        return new self(null, $challenge);
    }
}
