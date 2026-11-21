<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\RetryStatement;
use App\Modules\Charges\Http\Resources\StatementResource;
use App\Modules\Charges\Http\Support\IdempotencyHeader;
use App\Modules\Charges\Queries\Statements;
use Illuminate\Http\Request;

final class RetryStatementController
{
    public function __invoke(string $statement, Request $request, RetryStatement $reprendre, Statements $decomptes): StatementResource
    {
        IdempotencyHeader::read($request);
        $d = $reprendre->handle($statement);

        return new StatementResource($d, $decomptes->lines($d), $decomptes->files($d), $decomptes->plan($d));
    }
}
