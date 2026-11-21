<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Actions\MarkAllNotificationsRead;
use App\Modules\Notifications\Http\Requests\OrganizationFilterRequest;
use Illuminate\Http\JsonResponse;

final class MarkAllNotificationsReadController
{
    public function __invoke(OrganizationFilterRequest $request, MarkAllNotificationsRead $lecture): JsonResponse
    {
        return response()->json(['data' => ['updated' => $lecture->handle((string) $request->user()?->getAuthIdentifier(), $request->organizationId())]]);
    }
}
