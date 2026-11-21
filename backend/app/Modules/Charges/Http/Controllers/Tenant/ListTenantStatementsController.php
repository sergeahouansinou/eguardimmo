<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Tenant;

use App\Modules\Charges\Http\Requests\ListTenantStatementsRequest;
use App\Modules\Charges\Http\Resources\TenantStatementResource;
use App\Modules\Charges\Queries\TenantStatements;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ListTenantStatementsController
{
    public function __invoke(ListTenantStatementsRequest $request, LeaseDirectory $baux, TenantStatements $decomptes): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $page = $decomptes->page($baux->visibleToTenant($user->id, CarbonImmutable::today()), $request->leaseId(), $request->cursor(), $request->perPage());
        $liste = $page->getCollection();
        $pieces = $decomptes->sharedFiles($liste);
        $etales = $decomptes->planned($liste);

        return response()->json([
            'data' => array_values($liste->map(fn ($d): array => (new TenantStatementResource($d, null, $pieces, in_array($d->id, $etales, true)))->toArray($request))->all()),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }
}
