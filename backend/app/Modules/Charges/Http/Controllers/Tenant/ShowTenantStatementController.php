<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Tenant;

use App\Modules\Charges\Http\Resources\TenantStatementResource;
use App\Modules\Charges\Queries\TenantStatements;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantStatementController
{
    public function __invoke(string $statement, Request $request, LeaseDirectory $baux, TenantStatements $decomptes): TenantStatementResource
    {
        /** @var User $user */
        $user = $request->user();
        $d = $decomptes->get($baux->visibleToTenant($user->id, CarbonImmutable::today()), $statement);
        $seul = collect([$d]);

        return new TenantStatementResource($d, $decomptes->lines($seul), $decomptes->sharedFiles($seul), $decomptes->planned($seul) !== []);
    }
}
