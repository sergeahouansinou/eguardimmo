<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Actions\ConfirmVisit;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Http\Resources\Tenant\TenantInterventionResource;
use App\Modules\Maintenance\Http\Support\TenantPresenter;
use App\Modules\Maintenance\Support\TenantAccess;
use Illuminate\Http\Request;

final class ConfirmTenantVisitController
{
    public function __invoke(Request $request, string $intervention, string $visit, TenantAccess $acces, ConfirmVisit $action, TenantPresenter $presenter): TenantInterventionResource
    {
        /** @var User $user */
        $user = $request->user();
        $cible = $acces->intervention($user->id, $intervention);
        $acces->within($cible->organization_id, fn () => $action->handle($cible->id, $visit, ActorKind::Tenant));

        return $presenter->show($user->id, $cible->id);
    }
}
