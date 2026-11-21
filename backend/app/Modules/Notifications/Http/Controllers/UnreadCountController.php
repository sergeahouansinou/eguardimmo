<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Http\Requests\OrganizationFilterRequest;
use App\Modules\Notifications\Queries\NotificationList;
use Illuminate\Http\JsonResponse;

final class UnreadCountController
{
    public function __invoke(OrganizationFilterRequest $request, NotificationList $liste): JsonResponse
    {
        return response()->json(['data' => ['unread' => $liste->unreadCount((string) $request->user()?->getAuthIdentifier(), $request->organizationId())]]);
    }
}
