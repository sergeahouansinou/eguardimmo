<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Reporting\Http\Requests\ShowOwnerRentRequest;
use App\Modules\Reporting\Http\Resources\Owner\OwnerRentResource;
use App\Modules\Reporting\Queries\OwnerRent;
use App\Modules\Reporting\Support\Months;
use Carbon\CarbonImmutable;

final class ShowOwnerRentController
{
    public function __invoke(string $month, ShowOwnerRentRequest $request, MandateDirectory $mandats, OwnerRent $loyers): OwnerRentResource
    {
        /** @var User $user */
        $user = $request->user();
        [, $debut, $fin] = Months::bounds($month, CarbonImmutable::today());

        return new OwnerRentResource([
            'month' => $month,
            'mandants' => $loyers->month($mandats->ownerScope($user->id, $request->agency()), $debut, $fin),
        ]);
    }
}
