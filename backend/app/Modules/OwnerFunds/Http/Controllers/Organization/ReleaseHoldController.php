<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\ReleaseHold;
use App\Modules\OwnerFunds\Http\Resources\PayoutHoldResource;
use App\Modules\OwnerFunds\Support\Actor;
use Illuminate\Http\Request;

final class ReleaseHoldController
{
    public function __invoke(Request $request, string $hold, ReleaseHold $levee): PayoutHoldResource
    {
        return new PayoutHoldResource($levee->handle($hold, Actor::id($request)));
    }
}
