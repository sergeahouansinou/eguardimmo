<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\VoidStatement;
use App\Modules\Banking\Http\Requests\VoidStatementRequest;
use App\Modules\Banking\Http\Resources\BankStatementResource;
use App\Modules\Banking\Support\Actor;

final class VoidStatementController
{
    public function __invoke(VoidStatementRequest $request, string $statement, VoidStatement $annulation): BankStatementResource
    {
        return new BankStatementResource($annulation->handle($statement, trim((string) $request->validated('reason')), Actor::id($request)));
    }
}
