<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Http\Resources\CaseResource;
use App\Modules\Recovery\Queries\Cases;
use App\Modules\Recovery\Queries\CaseViews;

final class ShowCaseController
{
    public function __invoke(string $case, Cases $dossiers, CaseViews $vues): CaseResource
    {
        $dossier = $dossiers->get($case);

        return new CaseResource($dossier, $vues->of([$dossier]), true);
    }
}
