<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use App\Modules\Notifications\Enums\PushPlatform;

final readonly class NewPushTokenData
{
    public function __construct(
        public string $userId,
        public ?string $accessTokenId,
        public PushPlatform $platform,
        #[\SensitiveParameter] public string $token,
        public ?string $deviceName,
    ) {}
}
