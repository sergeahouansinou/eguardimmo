<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Actions\ReportServiceRequest;
use App\Modules\Maintenance\Http\Requests\StoreTenantInterventionRequest;
use App\Modules\Maintenance\Http\Support\TenantPresenter;
use Illuminate\Http\JsonResponse;

final class StoreTenantInterventionController
{
    public function __invoke(StoreTenantInterventionRequest $request, ReportServiceRequest $action, TenantPresenter $presenter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $resultat = $action->handle($user->id, $request->toData());

        return $presenter->show($user->id, $resultat['intervention']->id)->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
