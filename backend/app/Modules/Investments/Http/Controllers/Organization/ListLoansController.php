<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Http\Requests\ListLoansRequest;
use App\Modules\Investments\Http\Support\LoanViews;
use App\Modules\Investments\Queries\Loans;
use Illuminate\Http\JsonResponse;

final class ListLoansController
{
    public function __invoke(ListLoansRequest $requete, Loans $prets, LoanViews $vues): JsonResponse
    {
        $v = $requete->validated();
        $liste = $prets->list(isset($v['property_id']) ? (string) $v['property_id'] : null, isset($v['status']) ? (string) $v['status'] : null);

        return response()->json(['data' => array_map(fn ($r): array => $r->resolve(), $vues->many($liste))]);
    }
}
