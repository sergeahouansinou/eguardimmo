<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Http\Requests\ListPageRequest;
use App\Modules\Banking\Http\Resources\BankStatementResource;
use App\Modules\Banking\Models\BankStatement;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListStatementsController
{
    public function __invoke(ListPageRequest $request): AnonymousResourceCollection
    {
        $requete = BankStatement::query()->orderByDesc('period_to')->orderByDesc('id');

        if ($request->filled('account_id')) {
            $requete->where('bank_account_id', (string) $request->validated('account_id'));
        }

        return BankStatementResource::collection($requete->cursorPaginate($request->perPage()));
    }
}
