<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Push;

use App\Modules\Notifications\Data\PushMessage;
use App\Modules\Notifications\Enums\PushResult;
use App\Modules\Notifications\Models\PushToken;
use Illuminate\Contracts\Container\Container;

final readonly class PushChannel
{
    public function __construct(private Container $conteneur) {}

    public function enabled(): bool
    {
        return $this->driver() !== null;
    }

    public function send(PushToken $appareil, PushMessage $message): PushResult
    {
        $pilote = $this->driver();

        if ($pilote === null) {
            return PushResult::Disabled;
        }

        if ($appareil->token === null || $appareil->token === '') {
            return PushResult::InvalidToken;
        }

        return $pilote->send($appareil->token, $message);
    }

    private function driver(): ?PushDriver
    {
        return match (config('notifications.push.driver')) {
            'fcm' => $this->conteneur->make(FcmDriver::class),
            'fake' => $this->conteneur->make(FakeDriver::class),
            default => null,
        };
    }
}
