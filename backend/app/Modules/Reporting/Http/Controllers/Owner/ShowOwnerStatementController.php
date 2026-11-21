<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Reporting\Http\Requests\OwnerStatementRequest;
use App\Modules\Reporting\Http\Resources\PartyStatementResource;
use App\Modules\Reporting\Queries\OwnerStatement;
use App\Modules\Reporting\Support\OwnerSelection;
use App\Modules\Reporting\Support\StatementCsv;
use Illuminate\Http\Response;

final class ShowOwnerStatementController
{
    public function __invoke(OwnerStatementRequest $request, OwnerSelection $selection, OwnerStatement $releves): PartyStatementResource|Response
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $selection->one($user->id, $request->agency(), true);
        $format = $request->wantsCsv() ? 'csv' : 'json';
        $releve = $releves->of($portee->visibles[0], $request->from(), $request->to(), $format);

        if ($format === 'csv') {
            return response(StatementCsv::render($releve['statement'], $releve['currency']), 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="releve-mandant.csv"',
                'Cache-Control' => 'no-store, private',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        }

        return new PartyStatementResource($releve);
    }
}
