<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Push;

use App\Modules\Notifications\Data\PushMessage;
use App\Modules\Notifications\Enums\PushResult;

final class FakeDriver implements PushDriver
{
    /** @var list<array{token: string, message: PushMessage}> */
    public array $sent = [];

    /** @var list<string> */
    public array $invalidTokens = [];

    public bool $failing = false;

    public function send(#[\SensitiveParameter] string $deviceToken, PushMessage $message): PushResult
    {
        if ($this->failing) {
            return PushResult::Failed;
        }

        if (in_array($deviceToken, $this->invalidTokens, true)) {
            return PushResult::InvalidToken;
        }

        $this->sent[] = ['token' => $deviceToken, 'message' => $message];

        return PushResult::Sent;
    }
}
