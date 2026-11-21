<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Http\Requests\ListNotificationsRequest;
use App\Modules\Notifications\Http\Resources\NotificationPageResource;
use App\Modules\Notifications\Queries\NotificationList;

final class ListNotificationsController
{
    public function __invoke(ListNotificationsRequest $request, NotificationList $liste): NotificationPageResource
    {
        return new NotificationPageResource($liste->page((string) $request->user()?->getAuthIdentifier(), $request->toData(), $request->cursor(), $request->perPage()));
    }
}
