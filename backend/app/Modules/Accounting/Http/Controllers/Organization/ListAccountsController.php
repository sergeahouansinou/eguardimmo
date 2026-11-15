<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Controllers\Organization;

use App\Modules\Accounting\Http\Resources\AccountResource;
use App\Modules\Accounting\Queries\AccountOverview;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListAccountsController
{
    public function __invoke(AccountOverview $comptes): AnonymousResourceCollection
    {
        return AccountResource::collection($comptes->all());
    }
}
