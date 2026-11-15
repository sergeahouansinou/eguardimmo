<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Actions\UploadFile;
use App\Modules\Documents\Http\Requests\UploadFileRequest;
use App\Modules\Documents\Http\Resources\StoredFileResource;
use Illuminate\Http\JsonResponse;

final class UploadFileController
{
    public function __invoke(UploadFileRequest $request, UploadFile $televerser): JsonResponse
    {
        $fichier = $televerser->handle($request->source(), $request->displayName(), $request->category(), $request->subject(), $request->retentionUntil());

        return (new StoredFileResource($fichier))->response()->setStatusCode(201);
    }
}
