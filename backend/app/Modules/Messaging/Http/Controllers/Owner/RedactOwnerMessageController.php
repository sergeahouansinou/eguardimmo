<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\RedactMessageRequest;
use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartMessageResource;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use App\Modules\Messaging\Support\OwnerWriteGate;

final class RedactOwnerMessageController
{
    public function __invoke(RedactMessageRequest $request, string $conversation, string $message, OwnerThreads $fils, CounterpartDesk $bureau, OwnerWriteGate $garde): CounterpartMessageResource
    {
        /** @var User $user */
        $user = $request->user();
        $visibles = $fils->visibles($user->id);
        $fil = $fils->find($visibles, $conversation) ?? throw ErrorCode::ConversationNotFound->problem();
        $garde->assertCanReply($fils->visibleOf($visibles, $fil) ?? throw ErrorCode::ConversationNotFound->problem());

        return new CounterpartMessageResource(['message' => $bureau->redact($fil, $message, $user, MessageSide::Owner), 'viewer' => $user->id]);
    }
}
