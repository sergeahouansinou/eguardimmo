<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\SetConversationState;
use App\Modules\Messaging\Http\Resources\ConversationDetailResource;
use App\Modules\Messaging\Queries\StaffThreads;
use App\Modules\Messaging\Support\ConversationLoader;
use App\Modules\Messaging\Support\StaffAccess;
use App\Modules\Messaging\Support\StaffDesk;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ShowConversationController
{
    public function __invoke(Request $request, string $conversation, SetConversationState $etat, StaffThreads $fils, StaffDesk $bureau, StaffAccess $acces): JsonResource
    {
        /** @var User $user */
        $user = $request->user();
        $externe = $fils->find($user->id, $conversation);

        if ($externe !== null) {
            $acces->assertExternal($user, $externe->kind);

            return $bureau->show($externe, $user);
        }

        $participation = ConversationLoader::participation($request, $conversation);
        $etat->handle($participation, lu: true, archive: null);

        return new ConversationDetailResource($participation);
    }
}
