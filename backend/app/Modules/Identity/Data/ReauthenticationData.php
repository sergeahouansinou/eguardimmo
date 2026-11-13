<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use App\Modules\Identity\Enums\SocialProvider;
use SensitiveParameter;

final readonly class ReauthenticationData
{
    public function __construct(
        public bool $recentPasswordConfirmation,
        public bool $recentTwoFactorConfirmation,
        #[SensitiveParameter] public ?string $password = null,
        #[SensitiveParameter] public ?string $code = null,
        #[SensitiveParameter] public ?string $recoveryCode = null,
        public ?SocialProvider $provider = null,
        #[SensitiveParameter] public ?string $idToken = null,
        #[SensitiveParameter] public ?string $nonce = null,
    ) {}
}
