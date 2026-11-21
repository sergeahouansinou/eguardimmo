<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Http\Resources\BankMatchResource;
use App\Modules\Banking\Models\BankMatch;

final class ShowMatchController
{
    public function __invoke(string $match): BankMatchResource
    {
        return new BankMatchResource((BankMatch::query()->find($match) ?? throw ErrorCode::MatchNotFound->problem())->load('items'));
    }
}
