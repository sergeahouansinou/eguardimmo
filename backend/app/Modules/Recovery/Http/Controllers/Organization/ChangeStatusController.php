<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\ChangeCaseStatus;
use App\Modules\Recovery\Http\Requests\ChangeStatusRequest;
use App\Modules\Recovery\Http\Resources\CaseResource;
use App\Modules\Recovery\Queries\Cases;
use App\Modules\Recovery\Queries\CaseViews;
use Carbon\CarbonImmutable;

final class ChangeStatusController
{
    public function __invoke(string $case, ChangeStatusRequest $request, Cases $dossiers, ChangeCaseStatus $changer, CaseViews $vues): CaseResource
    {
        $modifie = $dossiers->get($changer->handle($dossiers->find($case), $request->status(), $request->reason(), CarbonImmutable::today())->id);

        return new CaseResource($modifie, $vues->of([$modifie]), true);
    }
}
