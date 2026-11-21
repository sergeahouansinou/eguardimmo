<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Http\Resources\BankStatementLineResource;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Queries\BankLines;

final class ShowLineController
{
    public function __invoke(string $line, BankLines $lignes): BankStatementLineResource
    {
        $ligne = BankStatementLine::query()->find($line) ?? throw ErrorCode::LineNotFound->problem();
        $lignes->decorateMany([$ligne]);

        return new BankStatementLineResource($ligne);
    }
}
