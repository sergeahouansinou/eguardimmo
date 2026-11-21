<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Http\Resources\StatementResource;
use App\Modules\Charges\Queries\Statements;

final class ShowStatementController
{
    public function __invoke(string $statement, Statements $decomptes): StatementResource
    {
        $d = $decomptes->get($statement);

        return new StatementResource($d, $decomptes->lines($d), $decomptes->files($d), $decomptes->plan($d));
    }
}
