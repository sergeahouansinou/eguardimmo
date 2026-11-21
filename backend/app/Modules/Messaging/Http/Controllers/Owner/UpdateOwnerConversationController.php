<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\ConversationStateRequest;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use App\Modules\Messaging\Support\OwnerWriteGate;
use Illuminate\Http\Resources\Json\JsonResource;

final class UpdateOwnerConversationController
{
    public function __invoke(ConversationStateRequest $request, string $conversation, OwnerThreads $fils, CounterpartDesk $bureau, OwnerWriteGate $garde): JsonResource
    {
        /** @var User $user */
        $user = $request->user();
        $visibles = $fils->visibles($user->id);
        $fil = $fils->find($visibles, $conversation) ?? throw ErrorCode::ConversationNotFound->problem();
        $bureau->mark($fil, $user, MessageSide::Owner, $request->read(), $request->archived());
        $fil = $fils->list($user->id, $visibles)->whereKey($conversation)->firstOrFail();
        $visible = $fils->visibleOf($visibles, $fil);

        return $bureau->show($fil, $user, $visible !== null && $garde->canReply($visible), 1);
    }
}
