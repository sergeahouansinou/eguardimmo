<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\RestoreLine;
use App\Modules\Banking\Http\Requests\RestoreLineRequest;
use App\Modules\Banking\Http\Resources\BankStatementLineResource;
use App\Modules\Banking\Queries\BankLines;

final class RestoreLineController
{
    public function __invoke(RestoreLineRequest $request, string $line, RestoreLine $restauration, BankLines $lignes): BankStatementLineResource
    {
        $resultat = $restauration->handle($line, (int) $request->validated('lock_version'));
        $lignes->decorateMany([$resultat]);

        return new BankStatementLineResource($resultat);
    }
}
