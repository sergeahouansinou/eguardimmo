<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Messaging\Queries\Inbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ConversationStatsController
{
    public function __invoke(Request $request, Inbox $boite): JsonResponse
    {
        return new JsonResponse(['data' => $boite->stats((string) $request->user()?->getAuthIdentifier())]);
    }
}
