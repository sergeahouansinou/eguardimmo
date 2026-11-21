<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Http\Requests\ListCounterpartThreadsRequest;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use App\Modules\Messaging\Support\OwnerWriteGate;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOwnerConversationsController
{
    public function __invoke(ListCounterpartThreadsRequest $request, OwnerThreads $fils, CounterpartDesk $bureau, OwnerWriteGate $garde): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $visibles = $fils->visibles($user->id, $request->agency());

        return $bureau->list($fils->list($user->id, $visibles), $user, $request->toData(), function (Conversation $fil) use ($fils, $visibles, $garde): bool {
            $visible = $fils->visibleOf($visibles, $fil);

            return $visible !== null && $garde->canReply($visible);
        });
    }
}
