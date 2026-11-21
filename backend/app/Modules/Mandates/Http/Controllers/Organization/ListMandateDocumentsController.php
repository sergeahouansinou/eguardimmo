<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Http\Requests\ListMandateDocumentsRequest;
use App\Modules\Mandates\Http\Resources\MandateDocumentResource;
use App\Modules\Mandates\Queries\MandateDocuments;
use App\Modules\Mandates\Queries\Mandates;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListMandateDocumentsController
{
    public function __invoke(string $mandate, ListMandateDocumentsRequest $request, Mandates $mandats, MandateDocuments $documents): AnonymousResourceCollection
    {
        return MandateDocumentResource::collection($documents->page($mandats->get($mandate)->id, $request->perPage(), $request->cursor()));
    }
}
