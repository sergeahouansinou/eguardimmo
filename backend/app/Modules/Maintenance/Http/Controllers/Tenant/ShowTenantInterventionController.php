<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Http\Resources\Tenant\TenantInterventionResource;
use App\Modules\Maintenance\Http\Support\TenantPresenter;
use Illuminate\Http\Request;

final class ShowTenantInterventionController
{
    public function __invoke(Request $request, string $intervention, TenantPresenter $presenter): TenantInterventionResource
    {
        /** @var User $user */
        $user = $request->user();

        return $presenter->show($user->id, $intervention);
    }
}
