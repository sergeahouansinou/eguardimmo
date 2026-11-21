<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Documents\Data\FileSource;
use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Actions\RecordInspection;
use App\Modules\Inspections\Http\Requests\RecordInspectionRequest;
use App\Modules\Inspections\Http\Resources\InspectionResource;
use Illuminate\Http\JsonResponse;

final class RecordInspectionController
{
    public function __invoke(string $lease, RecordInspectionRequest $request, RecordInspection $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $fichier = $request->uploaded();
        $resultat = $action->handle($user, $lease, $request->toData(), FileSource::path((string) $fichier->getRealPath()), $fichier->getClientOriginalName());

        return (new InspectionResource($resultat['inspection']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
