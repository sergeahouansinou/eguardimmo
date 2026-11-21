<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Http\Requests\ListOwnerInterventionsRequest;
use App\Modules\Maintenance\Http\Resources\Owner\OwnerInterventionPageResource;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Queries\OwnerInterventions;
use App\Modules\Maintenance\Queries\OwnerInterventionViews;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;

final class ListOwnerInterventionsController
{
    public function __invoke(ListOwnerInterventionsRequest $request, MandateDirectory $mandats, OwnerInterventions $interventions, OwnerInterventionViews $vues, OrganizationDirectory $organisations): OwnerInterventionPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $page = $interventions->page($mandats->ownerScope($user->id, $request->agency()), $request->perPage(), $request->cursor());
        $noms = $organisations->names(array_values(array_unique(array_map(fn (Intervention $i): string => $i->organization_id, $page->items()))));

        return new OwnerInterventionPageResource($page, $vues->build($page->items(), false), $noms);
    }
}
