<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\ShareMandateDocument;
use App\Modules\Mandates\Http\Requests\ShareMandateDocumentRequest;
use App\Modules\Mandates\Http\Resources\MandateDocumentResource;
use App\Modules\Mandates\Queries\Mandates;
use Illuminate\Http\JsonResponse;

final class ShareMandateDocumentController
{
    public function __invoke(string $mandate, ShareMandateDocumentRequest $request, Mandates $mandats, ShareMandateDocument $action): JsonResponse
    {
        $document = $action->handle($mandats->get($mandate), (string) $request->validated('stored_file_id'), $request->kind());

        return (new MandateDocumentResource($document))->response()->setStatusCode($document->wasRecentlyCreated ? 201 : 200);
    }
}
