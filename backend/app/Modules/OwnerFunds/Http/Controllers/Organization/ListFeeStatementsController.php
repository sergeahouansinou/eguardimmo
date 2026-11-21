<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Http\Requests\ListPageRequest;
use App\Modules\OwnerFunds\Http\Resources\FeeStatementResource;
use App\Modules\OwnerFunds\Models\FeeStatement;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListFeeStatementsController
{
    public function __invoke(ListPageRequest $request): AnonymousResourceCollection
    {
        $requete = FeeStatement::query()->orderByDesc('id');

        if ($request->filled('mandant')) {
            $requete->where('mandant_party_id', (string) $request->validated('mandant'));
        }

        if ($request->filled('month')) {
            $requete->where('period_start', $request->validated('month').'-01');
        }

        return FeeStatementResource::collection($requete->cursorPaginate($request->perPage()));
    }
}
