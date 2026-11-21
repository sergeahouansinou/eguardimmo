<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Http\Requests\ListOwnerPayoutsRequest;
use App\Modules\Reporting\Http\Resources\Owner\OwnerPayoutPageResource;
use App\Modules\Reporting\Queries\OwnerPayouts;
use Carbon\CarbonImmutable;

final class ListOwnerPayoutsController
{
    public function __invoke(ListOwnerPayoutsRequest $request, MandateDirectory $mandats, OwnerPayouts $reversements, OrganizationDirectory $organisations): OwnerPayoutPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $mandats->ownerScope($user->id, $request->agency());
        $page = $reversements->page($portee, $request->perPage(), $request->cursor());
        $prochains = $request->cursor() === null ? $reversements->next($portee, CarbonImmutable::today()) : [];
        $noms = $organisations->names($portee->organizationIds());

        return new OwnerPayoutPageResource($page, $portee, $noms, $prochains);
    }
}
