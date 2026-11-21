<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Actions\RequestVisitReschedule;
use App\Modules\Maintenance\Http\Requests\RescheduleRequest;
use App\Modules\Maintenance\Http\Resources\Tenant\TenantInterventionResource;
use App\Modules\Maintenance\Http\Support\TenantPresenter;
use App\Modules\Maintenance\Support\TenantAccess;

final class RequestTenantVisitRescheduleController
{
    public function __invoke(string $intervention, string $visit, RescheduleRequest $request, TenantAccess $acces, RequestVisitReschedule $action, TenantPresenter $presenter): TenantInterventionResource
    {
        /** @var User $user */
        $user = $request->user();
        $cible = $acces->intervention($user->id, $intervention);
        $acces->within($cible->organization_id, fn () => $action->handle($cible->id, $visit, $request->requestedOn(), $request->slot()));

        return $presenter->show($user->id, $cible->id);
    }
}
