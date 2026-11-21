<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\PostThreadMessageRequest;
use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartMessageResource;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use App\Modules\Messaging\Support\MessageInput;
use App\Modules\Messaging\Support\OwnerWriteGate;
use Illuminate\Http\JsonResponse;

final class PostOwnerMessageController
{
    public function __invoke(PostThreadMessageRequest $request, string $conversation, OwnerThreads $fils, CounterpartDesk $bureau, OwnerWriteGate $garde): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $visibles = $fils->visibles($user->id);
        $fil = $fils->find($visibles, $conversation) ?? throw ErrorCode::ConversationNotFound->problem();
        $garde->assertCanReply($fils->visibleOf($visibles, $fil) ?? throw ErrorCode::ConversationNotFound->problem());
        $envoye = $bureau->post($fil, $user, MessageSide::Owner, MessageInput::body($request), MessageInput::attachments($request), (string) MessageInput::clientId($request));

        return (new CounterpartMessageResource(['message' => $envoye->message, 'viewer' => $user->id]))->response()->setStatusCode($envoye->replayed ? 200 : 201);
    }
}
