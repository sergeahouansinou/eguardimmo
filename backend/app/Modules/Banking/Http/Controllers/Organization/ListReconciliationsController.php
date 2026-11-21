<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Http\Requests\ListPageRequest;
use App\Modules\Banking\Http\Resources\BankReconciliationResource;
use App\Modules\Banking\Models\BankReconciliation;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListReconciliationsController
{
    public function __invoke(ListPageRequest $request): AnonymousResourceCollection
    {
        $requete = BankReconciliation::query()->orderByDesc('as_of')->orderByDesc('id');

        if ($request->filled('account_id')) {
            $requete->where('bank_account_id', (string) $request->validated('account_id'));
        }

        if ($request->filled('status')) {
            $requete->where('status', (string) $request->validated('status'));
        }

        return BankReconciliationResource::collection($requete->cursorPaginate($request->perPage()));
    }
}
