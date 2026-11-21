<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\AddCaseItems;
use App\Modules\Recovery\Http\Requests\AddItemsRequest;
use App\Modules\Recovery\Http\Resources\CaseResource;
use App\Modules\Recovery\Queries\Cases;
use App\Modules\Recovery\Queries\CaseViews;
use Carbon\CarbonImmutable;

final class AddItemsController
{
    public function __invoke(string $case, AddItemsRequest $request, Cases $dossiers, AddCaseItems $ajouter, CaseViews $vues): CaseResource
    {
        $modifie = $dossiers->get($ajouter->handle($dossiers->find($case), $request->installmentIds(), CarbonImmutable::today(), $request->invoiceIds())->id);

        return new CaseResource($modifie, $vues->of([$modifie]), true);
    }
}
