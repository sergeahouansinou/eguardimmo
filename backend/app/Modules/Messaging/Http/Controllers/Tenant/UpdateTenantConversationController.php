<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\ConversationStateRequest;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use Carbon\CarbonImmutable;
use Illuminate\Http\Resources\Json\JsonResource;

final class UpdateTenantConversationController
{
    public function __invoke(ConversationStateRequest $request, string $conversation, TenantThreads $fils, CounterpartDesk $bureau): JsonResource
    {
        /** @var User $user */
        $user = $request->user();
        $fil = $fils->list($user->id, CarbonImmutable::today())->whereKey($conversation)->first() ?? throw ErrorCode::ConversationNotFound->problem();
        $bureau->mark($fil, $user, MessageSide::Tenant, $request->read(), $request->archived());

        return $bureau->show($fils->list($user->id, CarbonImmutable::today())->whereKey($conversation)->firstOrFail(), $user, true, 1);
    }
}
