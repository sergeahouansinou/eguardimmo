<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\UploadInterventionFile;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Http\Requests\UploadInterventionFileRequest;
use App\Modules\Maintenance\Http\Resources\FileResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

final class StoreInterventionFileController
{
    public function __invoke(string $intervention, UploadInterventionFileRequest $request, UploadInterventionFile $action): JsonResponse
    {
        /** @var UploadedFile $fichier */
        $fichier = $request->file('file');
        $ligne = $action->handle($intervention, $fichier, $request->kind(), ActorKind::Team, $request->visibleToTenant(), $request->visibleToOwner());

        return (new FileResource($ligne))->response()->setStatusCode(201);
    }
}
