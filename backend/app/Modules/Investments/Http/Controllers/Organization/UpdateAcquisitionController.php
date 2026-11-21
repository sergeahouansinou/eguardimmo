<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Actions\UpdateAcquisition;
use App\Modules\Investments\Http\Requests\UpdateAcquisitionRequest;
use App\Modules\Investments\Http\Resources\AcquisitionResource;

final class UpdateAcquisitionController
{
    public function __invoke(string $acquisition, UpdateAcquisitionRequest $requete, UpdateAcquisition $modifier): AcquisitionResource
    {
        $v = $requete->validated();

        return new AcquisitionResource($modifier->handle(
            $acquisition, (string) $v['acquired_on'], (int) $v['price'], (int) ($v['acquisition_costs'] ?? 0), (int) ($v['agency_fees'] ?? 0), (int) ($v['initial_works'] ?? 0), (int) $v['lock_version'],
        ));
    }
}
