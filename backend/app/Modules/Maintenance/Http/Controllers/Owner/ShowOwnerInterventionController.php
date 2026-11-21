<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Http\Resources\Owner\OwnerInterventionResource;
use App\Modules\Maintenance\Queries\OwnerInterventions;
use App\Modules\Maintenance\Queries\OwnerInterventionViews;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Illuminate\Http\Request;

final class ShowOwnerInterventionController
{
    public function __invoke(string $intervention, Request $request, MandateDirectory $mandats, OwnerInterventions $interventions, OwnerInterventionViews $vues, OrganizationDirectory $organisations): OwnerInterventionResource
    {
        /** @var User $user */
        $user = $request->user();
        $cible = $interventions->find($mandats->ownerScope($user->id), $intervention) ?? throw ErrorCode::OwnerInterventionNotFound->problem();

        return new OwnerInterventionResource([
            'intervention' => $cible,
            'view' => $vues->build([$cible], true)[$cible->id],
            'agency_name' => $organisations->names([$cible->organization_id])[$cible->organization_id] ?? null,
            'detail' => true,
        ]);
    }
}
