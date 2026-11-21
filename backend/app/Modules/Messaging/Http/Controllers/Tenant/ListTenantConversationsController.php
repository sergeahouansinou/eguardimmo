<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Http\Requests\ListCounterpartThreadsRequest;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use Carbon\CarbonImmutable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTenantConversationsController
{
    public function __invoke(ListCounterpartThreadsRequest $request, TenantThreads $fils, CounterpartDesk $bureau): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return $bureau->list($fils->list($user->id, CarbonImmutable::today()), $user, $request->toData(), fn (): bool => true);
    }
}
