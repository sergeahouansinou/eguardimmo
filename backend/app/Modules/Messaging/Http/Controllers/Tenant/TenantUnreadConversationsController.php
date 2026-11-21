<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Messaging\Queries\ThreadScopes;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TenantUnreadConversationsController
{
    public function __invoke(Request $request, TenantThreads $fils): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $requete = ThreadScopes::archived($fils->visible($user->id, CarbonImmutable::today()), $user->id, false);

        return new JsonResponse(['data' => ['unread' => ThreadScopes::unread($requete, $user->id)->count()]]);
    }
}
