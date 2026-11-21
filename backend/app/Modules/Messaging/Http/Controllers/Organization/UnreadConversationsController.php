<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Queries\Inbox;
use App\Modules\Messaging\Queries\StaffThreads;
use App\Modules\Messaging\Support\StaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Compteurs légers pour l'interrogation périodique : fils non lus par type. Les types réservés au rôle de l'appelant valent 0.
 */
final class UnreadConversationsController
{
    public function __invoke(Request $request, Inbox $boite, StaffThreads $fils, StaffAccess $acces): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return new JsonResponse(['data' => [
            ConversationKind::Internal->value => $boite->stats($user->id)['unread'],
            ...$fils->unread($user->id, $acces->canReadExternal($user, ConversationKind::Tenant), $acces->canReadExternal($user, ConversationKind::Owner)),
        ]]);
    }
}
