<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Http\Requests\RedactMessageRequest;
use App\Modules\Messaging\Http\Resources\Organization\ExternalMessageResource;
use App\Modules\Messaging\Queries\StaffThreads;
use App\Modules\Messaging\Support\StaffAccess;
use App\Modules\Messaging\Support\StaffDesk;

final class RedactConversationMessageController
{
    public function __invoke(RedactMessageRequest $request, string $conversation, string $message, StaffThreads $fils, StaffDesk $bureau, StaffAccess $acces): ExternalMessageResource
    {
        /** @var User $user */
        $user = $request->user();
        $fil = $fils->find($user->id, $conversation) ?? throw ErrorCode::ConversationNotFound->problem();
        $acces->assertExternal($user, $fil->kind);

        return $bureau->messageResource($bureau->redact($request, $fil, $message, $user, $request->reason()), $user);
    }
}
