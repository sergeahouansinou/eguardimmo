<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Actions\CancelIntervention;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Http\Resources\Tenant\TenantInterventionResource;
use App\Modules\Maintenance\Http\Support\TenantPresenter;
use App\Modules\Maintenance\Support\TenantAccess;
use Illuminate\Http\Request;

final class CancelTenantInterventionController
{
    public function __invoke(Request $request, string $intervention, TenantAccess $acces, CancelIntervention $action, TenantPresenter $presenter): TenantInterventionResource
    {
        /** @var User $user */
        $user = $request->user();
        $cible = $acces->intervention($user->id, $intervention);
        $signalant = $cible->lease_id === null ? throw ErrorCode::TransitionInvalid->problem() : $acces->reporter($user->id, $cible->organization_id, $cible->lease_id);
        $acces->within($cible->organization_id, fn () => $action->handle($cible->id, ActorKind::Tenant, null, $signalant));

        return $presenter->show($user->id, $cible->id);
    }
}
