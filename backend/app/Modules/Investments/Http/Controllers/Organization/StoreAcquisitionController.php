<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Actions\CreateAcquisition;
use App\Modules\Investments\Http\Requests\StoreAcquisitionRequest;
use App\Modules\Investments\Http\Resources\AcquisitionResource;
use App\Modules\Investments\Http\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class StoreAcquisitionController
{
    public function __invoke(StoreAcquisitionRequest $requete, CreateAcquisition $creer): JsonResponse
    {
        $resultat = $creer->handle($requete->toData(IdempotencyHeader::read($requete)));

        return (new AcquisitionResource($resultat['acquisition']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
