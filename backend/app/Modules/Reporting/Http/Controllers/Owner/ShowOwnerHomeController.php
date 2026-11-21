<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Reporting\Http\Requests\ShowOwnerRentRequest;
use App\Modules\Reporting\Http\Resources\Owner\OwnerHomeResource;
use App\Modules\Reporting\Queries\OwnerHome;
use App\Modules\Reporting\Support\OwnerSelection;
use Carbon\CarbonImmutable;

final class ShowOwnerHomeController
{
    public function __invoke(ShowOwnerRentRequest $request, OwnerSelection $selection, OwnerHome $accueil): OwnerHomeResource
    {
        /** @var User $user */
        $user = $request->user();

        return new OwnerHomeResource($accueil->of($selection->one($user->id, $request->agency()), CarbonImmutable::today()));
    }
}
