<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\IgnoreLine;
use App\Modules\Banking\Enums\IgnoreReason;
use App\Modules\Banking\Http\Requests\IgnoreLineRequest;
use App\Modules\Banking\Http\Resources\BankStatementLineResource;
use App\Modules\Banking\Queries\BankLines;

final class IgnoreLineController
{
    public function __invoke(IgnoreLineRequest $request, string $line, IgnoreLine $ignorer, BankLines $lignes): BankStatementLineResource
    {
        $v = $request->validated();
        $resultat = $ignorer->handle($line, IgnoreReason::from((string) $v['reason']), (int) $v['lock_version'], isset($v['pair_line_id']) ? (string) $v['pair_line_id'] : null);
        $lignes->decorateMany([$resultat]);

        return new BankStatementLineResource($resultat);
    }
}
