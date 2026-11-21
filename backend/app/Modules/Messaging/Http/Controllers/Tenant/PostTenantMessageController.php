<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\PostThreadMessageRequest;
use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartMessageResource;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use App\Modules\Messaging\Support\MessageInput;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class PostTenantMessageController
{
    public function __invoke(PostThreadMessageRequest $request, string $conversation, TenantThreads $fils, CounterpartDesk $bureau): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $fil = $fils->find($user->id, $conversation, CarbonImmutable::today()) ?? throw ErrorCode::ConversationNotFound->problem();
        $envoye = $bureau->post($fil, $user, MessageSide::Tenant, MessageInput::body($request), MessageInput::attachments($request), (string) MessageInput::clientId($request));

        return (new CounterpartMessageResource(['message' => $envoye->message, 'viewer' => $user->id]))->response()->setStatusCode($envoye->replayed ? 200 : 201);
    }
}
