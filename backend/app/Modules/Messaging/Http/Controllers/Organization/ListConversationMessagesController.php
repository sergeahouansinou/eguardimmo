<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Http\Requests\ListThreadMessagesRequest;
use App\Modules\Messaging\Queries\StaffThreads;
use App\Modules\Messaging\Support\StaffAccess;
use App\Modules\Messaging\Support\StaffDesk;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListConversationMessagesController
{
    public function __invoke(ListThreadMessagesRequest $request, string $conversation, StaffThreads $fils, StaffDesk $bureau, StaffAccess $acces): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $fil = $fils->find($user->id, $conversation) ?? throw ErrorCode::ConversationNotFound->problem();
        $acces->assertExternal($user, $fil->kind);

        return $bureau->messages($fil, $user, $request->afterId(), $request->cursor(), $request->perPage());
    }
}
