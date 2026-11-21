<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Messaging\Queries\ThreadScopes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OwnerUnreadConversationsController
{
    public function __invoke(Request $request, OwnerThreads $fils): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $requete = ThreadScopes::archived($fils->visible($fils->visibles($user->id)), $user->id, false);

        return new JsonResponse(['data' => ['unread' => ThreadScopes::unread($requete, $user->id)->count()]]);
    }
}
