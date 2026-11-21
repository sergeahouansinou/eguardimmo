<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use App\Modules\Messaging\Support\OwnerWriteGate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ShowOwnerConversationController
{
    public function __invoke(Request $request, string $conversation, OwnerThreads $fils, CounterpartDesk $bureau, OwnerWriteGate $garde): JsonResource
    {
        /** @var User $user */
        $user = $request->user();
        $visibles = $fils->visibles($user->id);
        $fil = $fils->list($user->id, $visibles)->whereKey($conversation)->first() ?? throw ErrorCode::ConversationNotFound->problem();
        $visible = $fils->visibleOf($visibles, $fil);

        return $bureau->show($fil, $user, $visible !== null && $garde->canReply($visible));
    }
}
