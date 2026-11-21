<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Actions\MarkNotificationRead;
use App\Modules\Notifications\Http\Resources\NotificationResource;
use Illuminate\Http\Request;

final class MarkNotificationReadController
{
    public function __invoke(Request $request, string $notification, MarkNotificationRead $lecture): NotificationResource
    {
        return new NotificationResource($lecture->handle((string) $request->user()?->getAuthIdentifier(), $notification));
    }
}
