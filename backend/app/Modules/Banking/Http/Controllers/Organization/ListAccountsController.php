<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Http\Resources\BankAccountResource;
use App\Modules\Banking\Queries\BankAccounts;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListAccountsController
{
    public function __invoke(Request $request, BankAccounts $comptes): AnonymousResourceCollection
    {
        return BankAccountResource::collection($comptes->query()->orderBy('ledger_role')->orderByDesc('created_at')->get());
    }
}
