<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Actions\FileLibraryDocument;
use App\Modules\Documents\Http\Requests\FileLibraryDocumentRequest;
use App\Modules\Documents\Http\Resources\LibraryDocumentResource;
use Illuminate\Http\JsonResponse;

final class FileLibraryDocumentController
{
    public function __invoke(FileLibraryDocumentRequest $request, FileLibraryDocument $deposer): JsonResponse
    {
        $entree = $deposer->handle($request->source(), $request->displayName(), $request->kind(), $request->subject(), $request->retentionUntil());

        return (new LibraryDocumentResource($entree))->response()->setStatusCode(201);
    }
}
