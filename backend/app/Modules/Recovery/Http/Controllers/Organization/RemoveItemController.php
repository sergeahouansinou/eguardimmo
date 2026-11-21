<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\RemoveCaseItem;
use App\Modules\Recovery\Http\Resources\CaseResource;
use App\Modules\Recovery\Queries\Cases;
use App\Modules\Recovery\Queries\CaseViews;

final class RemoveItemController
{
    public function __invoke(string $case, string $item, Cases $dossiers, RemoveCaseItem $retirer, CaseViews $vues): CaseResource
    {
        $modifie = $dossiers->get($retirer->handle($dossiers->find($case), $item)->id);

        return new CaseResource($modifie, $vues->of([$modifie]), true);
    }
}
