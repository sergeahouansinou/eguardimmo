<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\RedactMessageRequest;
use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartMessageResource;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use Carbon\CarbonImmutable;

final class RedactTenantMessageController
{
    public function __invoke(RedactMessageRequest $request, string $conversation, string $message, TenantThreads $fils, CounterpartDesk $bureau): CounterpartMessageResource
    {
        /** @var User $user */
        $user = $request->user();
        $fil = $fils->find($user->id, $conversation, CarbonImmutable::today()) ?? throw ErrorCode::ConversationNotFound->problem();

        return new CounterpartMessageResource(['message' => $bureau->redact($fil, $message, $user, MessageSide::Tenant), 'viewer' => $user->id]);
    }
}
