<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ShowTenantConversationController
{
    public function __invoke(Request $request, string $conversation, TenantThreads $fils, CounterpartDesk $bureau): JsonResource
    {
        /** @var User $user */
        $user = $request->user();
        $fil = $fils->list($user->id, CarbonImmutable::today())->whereKey($conversation)->first() ?? throw ErrorCode::ConversationNotFound->problem();

        return $bureau->show($fil, $user, true);
    }
}
