<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Owner;

use App\Modules\Charges\Http\Requests\ListOwnerStatementsRequest;
use App\Modules\Charges\Http\Resources\OwnerStatementResource;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Queries\OwnerStatements;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Illuminate\Http\JsonResponse;

final class ListOwnerStatementsController
{
    public function __invoke(ListOwnerStatementsRequest $request, MandateDirectory $mandats, OwnerStatements $decomptes, OrganizationDirectory $organisations): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $page = $decomptes->page($mandats->ownerScope($user->id, $request->agency()), $request->cursor(), $request->perPage());
        $noms = $organisations->names(array_values(array_unique(array_map(fn (ChargeStatement $d): string => $d->organization_id, $page->items()))));

        return response()->json([
            'data' => array_values(array_map(fn (ChargeStatement $d): array => (new OwnerStatementResource($d, null, $noms[$d->organization_id] ?? null))->toArray($request), $page->items())),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }
}
