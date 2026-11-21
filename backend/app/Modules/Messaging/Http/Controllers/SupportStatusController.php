<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Support\SupportHours;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;

final class SupportStatusController
{
    public function __invoke(): JsonResponse
    {
        try {
            $horaires = SupportHours::fromConfig();
        } catch (InvalidArgumentException $erreur) {
            report($erreur);

            throw ErrorCode::SupportHoursUnavailable->problem();
        }

        return new JsonResponse(['data' => [
            'online' => $horaires->isOnline(now()),
            'hours_label' => $horaires->label(),
            'response_label' => (string) config('messaging.support.response_label'),
            'timezone' => $horaires->timezone,
            'hours' => $horaires->windows(),
        ]]);
    }
}
